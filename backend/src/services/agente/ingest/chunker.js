const crypto = require('crypto');

/**
 * Módulo de ingestão e chunking do RAG do IFConnect.
 * Funções puras: sem acesso a banco de dados, sem rede e sem efeitos colaterais.
 *
 * Regras de conformidade da Análise de Viabilidade (spec-rag.md):
 * - RN-02: Dados pessoais (autor, instituição, email, etc.) NUNCA entram no texto indexado.
 * - RN-05: Valores financeiros (metaFinanceira, valorArrecadado) NUNCA entram no texto indexado.
 */

const TAMANHO_CHUNK = 800;
const SOBREPOSICAO = 100;
const CHUNKER_VERSION = 1;

/**
 * Garante que uma posição de corte não quebre um par substituto UTF-16 (emoji/caractere especial).
 */
function ajustarCorteSurrogate(str, pos) {
  if (pos <= 0 || pos >= str.length) return pos;
  const code = str.charCodeAt(pos - 1);
  if (code >= 0xd800 && code <= 0xdbff) {
    return pos - 1;
  }
  return pos;
}

/**
 * Remove eventuais substitutos UTF-16 órfãos no início ou no fim de uma fatia.
 */
function limparSurrogatesOrfaos(str) {
  if (!str) return '';
  let s = str;
  if (s.length > 0) {
    const primeiro = s.charCodeAt(0);
    if (primeiro >= 0xdc00 && primeiro <= 0xdfff) {
      s = s.slice(1);
    }
  }
  if (s.length > 0) {
    const ultimo = s.charCodeAt(s.length - 1);
    if (ultimo >= 0xd800 && ultimo <= 0xdbff) {
      s = s.slice(0, -1);
    }
  }
  return s;
}

/**
 * Extrai a cauda do chunk anterior para sobreposição no chunk seguinte.
 * Pega até `sobreposicao` caracteres, cortada no início de uma palavra completa.
 */
function extrairCauda(chunk, sobreposicao) {
  if (!chunk || sobreposicao <= 0) return '';
  if (chunk.length <= sobreposicao) {
    return limparSurrogatesOrfaos(chunk.trim());
  }

  const trecho = chunk.slice(-sobreposicao);
  const charAnterior = chunk[chunk.length - sobreposicao - 1];

  // Se o caractere anterior ao trecho era espaço ou quebra, o trecho já inicia em início de palavra
  if (charAnterior === ' ' || charAnterior === '\n' || charAnterior === '\t') {
    return limparSurrogatesOrfaos(trecho.trimStart());
  }

  // Se caiu no meio de uma palavra, avança até o início da próxima palavra
  const primeiroEspaco = trecho.search(/\s/);
  if (primeiroEspaco !== -1) {
    return limparSurrogatesOrfaos(trecho.slice(primeiroEspaco + 1).trimStart());
  }

  // Palavra única sem espaços na janela de sobreposição: não há início de palavra
  return '';
}

/**
 * Encontra a melhor posição de corte em uma janela de texto:
 * 1. Fim de parágrafo (\n\n)
 * 2. Fim de frase ([.!?…] seguido de espaço/quebra)
 * 3. Fim de palavra (espaço ou quebra simples)
 * 4. Corte duro respeitando pares substitutos UTF-16
 */
function encontrarPontoDeCorte(janela, maxLen) {
  // 1. Tenta cortar no final de um parágrafo (\n\n)
  const idxParagrafo = janela.lastIndexOf('\n\n');
  if (idxParagrafo > 0) {
    return { corte: idxParagrafo, avanco: idxParagrafo + 2 };
  }

  // 2. Tenta cortar no final de uma frase
  const regexFrase = /[.!?…][ \t\n]/g;
  let ultimoFimFrase = -1;
  let match;
  while ((match = regexFrase.exec(janela)) !== null) {
    if (match.index + 1 <= maxLen) {
      ultimoFimFrase = match.index + 1;
    }
  }
  if (ultimoFimFrase > 0) {
    let avanco = ultimoFimFrase;
    while (avanco < janela.length && /\s/.test(janela[avanco])) {
      avanco++;
    }
    return { corte: ultimoFimFrase, avanco };
  }

  // 3. Tenta cortar no último espaço ou quebra de linha
  const idxEspaco = Math.max(
    janela.lastIndexOf(' '),
    janela.lastIndexOf('\n'),
    janela.lastIndexOf('\t')
  );
  if (idxEspaco > 0) {
    let avanco = idxEspaco;
    while (avanco < janela.length && /\s/.test(janela[avanco])) {
      avanco++;
    }
    return { corte: idxEspaco, avanco };
  }

  // 4. Corte duro na palavra sem espaços
  const corteDuro = ajustarCorteSurrogate(janela, maxLen);
  return { corte: corteDuro, avanco: corteDuro };
}

/**
 * Normaliza e divide um texto em chunks de tamanho máximo com sobreposição.
 *
 * @param {string} texto
 * @param {object} [opcoes]
 * @param {number} [opcoes.tamanho=TAMANHO_CHUNK]
 * @param {number} [opcoes.sobreposicao=SOBREPOSICAO]
 * @returns {string[]}
 */
function dividir(texto, { tamanho = TAMANHO_CHUNK, sobreposicao = SOBREPOSICAO } = {}) {
  if (typeof tamanho !== 'number' || tamanho <= 0) {
    throw new RangeError('O parâmetro tamanho deve ser um número maior que zero.');
  }
  if (typeof sobreposicao !== 'number' || sobreposicao < 0) {
    throw new RangeError('O parâmetro sobreposicao deve ser um número maior ou igual a zero.');
  }
  if (sobreposicao >= tamanho) {
    throw new RangeError('O parâmetro sobreposicao deve ser estritamente menor que tamanho.');
  }

  if (texto === null || texto === undefined) return [];

  let t = String(texto)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim();

  if (!t) return [];
  if (t.length <= tamanho) return [limparSurrogatesOrfaos(t)];

  const chunks = [];
  let cursor = 0;
  let cauda = '';

  while (cursor < t.length) {
    let espacoMaxNovo = tamanho;
    if (cauda) {
      // 1 caractere reservado para o espaço que une cauda e novo conteúdo
      espacoMaxNovo = tamanho - cauda.length - 1;
      if (espacoMaxNovo <= 0) {
        cauda = '';
        espacoMaxNovo = tamanho;
      }
    }

    const restante = t.slice(cursor);
    if (restante.length <= espacoMaxNovo) {
      const conteudoNovo = restante.trim();
      if (conteudoNovo) {
        const chunkFinal = cauda ? `${cauda} ${conteudoNovo}` : conteudoNovo;
        chunks.push(limparSurrogatesOrfaos(chunkFinal));
      }
      break;
    }

    const janela = t.slice(cursor, cursor + espacoMaxNovo);
    const { corte, avanco } = encontrarPontoDeCorte(janela, espacoMaxNovo);

    const conteudoNovo = janela.slice(0, corte).trim();
    if (conteudoNovo) {
      const chunkCriado = cauda ? `${cauda} ${conteudoNovo}` : conteudoNovo;
      const chunkLimpo = limparSurrogatesOrfaos(chunkCriado);
      chunks.push(chunkLimpo);
      cauda = extrairCauda(chunkLimpo, sobreposicao);
    } else {
      // Caso de segurança para corte duro de palavra isolada sem espaço
      const corteDuro = ajustarCorteSurrogate(janela, espacoMaxNovo);
      const pedacoDuro = janela.slice(0, corteDuro);
      chunks.push(limparSurrogatesOrfaos(pedacoDuro));
      cauda = '';
    }

    const proximoCursor = cursor + (avanco > 0 ? avanco : 1);
    if (proximoCursor <= cursor) {
      cursor++;
    } else {
      cursor = proximoCursor;
    }
  }

  return chunks;
}

/**
 * Extrai os dados essenciais de um artigo para indexação.
 * NUNCA inclui dados pessoais nem dados editoriais sensíveis.
 */
function montarDocumentoArtigo(artigo) {
  const raw = typeof artigo?.get === 'function' ? artigo.get({ plain: true }) : (artigo || {});

  const categoria = raw.categoria && typeof raw.categoria === 'object'
    ? raw.categoria.nome
    : (typeof raw.categoria === 'string' ? raw.categoria : undefined);

  const metadados = {};
  if (raw.resumo) metadados.resumo = String(raw.resumo).trim();
  if (raw.tipo) metadados.tipo = String(raw.tipo).trim();
  if (categoria) metadados.categoria = String(categoria).trim();
  if (raw.tema) metadados.tema = String(raw.tema).trim();
  if (raw.palavrasChave) metadados.palavrasChave = String(raw.palavrasChave).trim();

  return {
    sourceType: 'artigo',
    sourceId: raw.id,
    titulo: raw.titulo ? String(raw.titulo).trim() : '',
    metadados,
    corpo: raw.conteudo ? String(raw.conteudo).trim() : '',
  };
}

/**
 * Extrai os dados essenciais de uma campanha para indexação.
 * NUNCA inclui valores financeiros nem dados pessoais.
 */
function montarDocumentoCampanha(campanha) {
  const raw = typeof campanha?.get === 'function' ? campanha.get({ plain: true }) : (campanha || {});

  const categoria = raw.categoria && typeof raw.categoria === 'object'
    ? raw.categoria.nome
    : (typeof raw.categoria === 'string' ? raw.categoria : undefined);

  const metadados = {};
  if (categoria) metadados.categoria = String(categoria).trim();
  if (raw.tema) metadados.tema = String(raw.tema).trim();
  if (raw.palavrasChave) metadados.palavrasChave = String(raw.palavrasChave).trim();

  return {
    sourceType: 'campanha',
    sourceId: raw.id,
    titulo: raw.titulo ? String(raw.titulo).trim() : '',
    metadados,
    corpo: raw.descricao ? String(raw.descricao).trim() : '',
  };
}

/**
 * Divide um documento em chunks estruturados com prefixo de título e metadados no chunk 0.
 *
 * @param {object} doc - Objeto retornado por montarDocumentoArtigo ou montarDocumentoCampanha
 * @param {object} [opcoes]
 * @returns {Array<{ chunkIndex: number, texto: string }>}
 */
function dividirDocumento(doc, opcoes = {}) {
  if (!doc) return [];

  const titulo = (doc.titulo || '').trim();
  const corpo = (doc.corpo || '').trim();
  const meta = doc.metadados || {};

  // Monta as linhas de metadados apenas para campos presentes
  const linhasMetadados = [];
  if (meta.resumo) linhasMetadados.push(`Resumo: ${meta.resumo}`);
  if (meta.categoria) linhasMetadados.push(`Categoria: ${meta.categoria}`);
  if (meta.tema) linhasMetadados.push(`Tema: ${meta.tema}`);
  if (meta.palavrasChave) linhasMetadados.push(`Palavras-chave: ${meta.palavrasChave}`);

  const temMetadadosUteis = linhasMetadados.length > 0;
  const temCorpo = Boolean(corpo);

  // Documento sem corpo e sem metadados úteis não gera chunks
  if (!temCorpo && !temMetadadosUteis) {
    return [];
  }

  const prefixoTitulo = titulo ? `Título: ${titulo}\n` : 'Título:\n';
  const blocoMetadados = linhasMetadados.join('\n');

  // Caso tenha metadados mas não tenha corpo
  if (!temCorpo && temMetadadosUteis) {
    return [
      {
        chunkIndex: 0,
        texto: `${prefixoTitulo}${blocoMetadados}`,
      },
    ];
  }

  const chunksCorpo = dividir(corpo, opcoes);
  if (!chunksCorpo.length) {
    if (temMetadadosUteis) {
      return [{ chunkIndex: 0, texto: `${prefixoTitulo}${blocoMetadados}` }];
    }
    return [];
  }

  return chunksCorpo.map((chunkTexto, i) => {
    if (i === 0) {
      const miolo = temMetadadosUteis ? `${blocoMetadados}\n${chunkTexto}` : chunkTexto;
      return {
        chunkIndex: 0,
        texto: `${prefixoTitulo}${miolo}`,
      };
    }
    return {
      chunkIndex: i,
      texto: `${prefixoTitulo}${chunkTexto}`,
    };
  });
}

/**
 * Gera hash SHA-256 hex determinístico de 64 caracteres para o documento.
 * Mudanças no título, metadados, corpo ou parâmetros invalidam o hash.
 */
function hashDocumento(doc, opcoes = {}) {
  const tamanho = opcoes.tamanho !== undefined ? opcoes.tamanho : TAMANHO_CHUNK;
  const sobreposicao = opcoes.sobreposicao !== undefined ? opcoes.sobreposicao : SOBREPOSICAO;

  const titulo = doc?.titulo || '';
  const corpo = doc?.corpo || '';

  const metaObj = doc?.metadados || {};
  const chavesOrdenadas = Object.keys(metaObj).sort();
  const metaOrdenado = {};
  for (const k of chavesOrdenadas) {
    metaOrdenado[k] = metaObj[k];
  }
  const metadadosSerializados = JSON.stringify(metaOrdenado);

  const payload = `${CHUNKER_VERSION}|${tamanho}|${sobreposicao}|${titulo}|${metadadosSerializados}|${corpo}`;

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

module.exports = {
  TAMANHO_CHUNK,
  SOBREPOSICAO,
  CHUNKER_VERSION,
  montarDocumentoArtigo,
  montarDocumentoCampanha,
  dividir,
  dividirDocumento,
  hashDocumento,
};

