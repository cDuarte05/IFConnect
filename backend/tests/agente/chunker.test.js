const {
  TAMANHO_CHUNK,
  SOBREPOSICAO,
  CHUNKER_VERSION,
  montarDocumentoArtigo,
  montarDocumentoCampanha,
  dividir,
  dividirDocumento,
  hashDocumento,
} = require('../../src/services/agente/ingest/chunker');

describe('Módulo de Chunking do RAG (services/agente/ingest/chunker.js)', () => {
  test('1. dividir: null, "", "   " -> []; texto curto -> 1 chunk igual ao texto aparado', () => {
    expect(dividir(null)).toEqual([]);
    expect(dividir(undefined)).toEqual([]);
    expect(dividir('')).toEqual([]);
    expect(dividir('   \n\t  ')).toEqual([]);

    const curto = 'Texto curto para teste.';
    expect(dividir(`  ${curto}  `)).toEqual([curto]);
  });

  test('2. texto de 20.000 caracteres (parágrafos com várias frases): todos os chunks <= 800, mais de 20 chunks, nenhum vazio', () => {
    const frase =
      'A pesquisa e extensão no IFConnect promovem desenvolvimento científico e tecnológico para a comunidade estudantil. ';
    const paragrafo = frase.repeat(5) + '\n\n';
    const texto20k = paragrafo.repeat(35); // Mais de 20.000 caracteres
    expect(texto20k.length).toBeGreaterThan(20000);

    const chunks = dividir(texto20k);

    expect(chunks.length).toBeGreaterThan(20);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(TAMANHO_CHUNK);
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });

  test('3. sobreposição: para chunks consecutivos, a primeira palavra do chunk i+1 aparece nos últimos 100 caracteres do chunk i', () => {
    const paragrafo =
      'Desenvolvimento de projetos de robótica educacional com microcontroladores Arduino e sensores diversos para escolas públicas. ';
    const texto = paragrafo.repeat(25);
    const chunks = dividir(texto, { tamanho: 500, sobreposicao: 100 });

    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length - 1; i++) {
      const chunkAtual = chunks[i];
      const chunkProx = chunks[i + 1];

      const primeiraPalavraProx = chunkProx.trim().split(/\s+/)[0];
      const ultimos100Atual = chunkAtual.slice(-100);

      expect(ultimos100Atual).toContain(primeiraPalavraProx);
    }
  });

  test('4. palavra única de 2.000 caracteres sem espaços: cortes duros, todos <= 800, nenhum caractere perdido', () => {
    const palavraGigante = 'X'.repeat(2000);
    const chunks = dividir(palavraGigante, { tamanho: 800, sobreposicao: 100 });

    expect(chunks.length).toBe(3); // 800 + 800 + 400
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(800);
    }
    expect(chunks.join('')).toBe(palavraGigante);
  });

  test('5. acentos e emoji: nenhum chunk termina/começa com par substituto quebrado, acentuação preservada', () => {
    const textoComEmoji =
      'Robótica 🤖 com inteligência artificial 🚀 e aprendizado contínuo para o futuro da educação pública! '.repeat(
        25
      );
    const chunks = dividir(textoComEmoji, { tamanho: 300, sobreposicao: 50 });

    const regexSurrogateSolto =
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

    for (const chunk of chunks) {
      expect(chunk).not.toMatch(regexSurrogateSolto);
      expect(chunk).toContain('Robótica');
      expect(chunk).toContain('inteligência');
    }
  });

  test('6. \\r\\n é tratado como \\n', () => {
    const textoCrlf = 'Primeira linha.\r\nSegunda linha.\r\n\r\nTerceiro parágrafo.';
    const chunks = dividir(textoCrlf);

    expect(chunks.length).toBe(1);
    expect(chunks[0]).not.toContain('\r');
    expect(chunks[0]).toContain('\n');
  });

  test('7. cobertura: todas as palavras do texto original aparecem em pelo menos um chunk', () => {
    const texto =
      'Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliet Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey Xray Yankee Zulu';
    const chunks = dividir(texto, { tamanho: 60, sobreposicao: 20 });

    const palavrasOriginais = texto.split(' ');
    const textoCombinadoChunks = chunks.join(' ');

    for (const p of palavrasOriginais) {
      expect(textoCombinadoChunks).toContain(p);
    }
  });

  test('8. parâmetros inválidos lançam RangeError', () => {
    expect(() => dividir('texto', { tamanho: 0 })).toThrow(RangeError);
    expect(() => dividir('texto', { tamanho: -10 })).toThrow(RangeError);
    expect(() => dividir('texto', { sobreposicao: -5 })).toThrow(RangeError);
    expect(() => dividir('texto', { tamanho: 100, sobreposicao: 100 })).toThrow(RangeError);
    expect(() => dividir('texto', { tamanho: 100, sobreposicao: 150 })).toThrow(RangeError);
  });

  test('9. montarDocumento*: dados pessoais e financeiros NÃO aparecem nos chunks finais', () => {
    const artigo = {
      id: 'art-1',
      titulo: 'Desenvolvimento Sustentável',
      resumo: 'Estudo ecológico',
      conteudo: 'Conteúdo detalhado sobre conservação ambiental.',
      tipo: 'artigo_cientifico',
      tema: 'cientifico',
      palavrasChave: 'ecologia, meio ambiente',
      autor: { nome: 'Fulano de Tal', instituicao: 'IFSP' },
      status: 'publicado',
      imagemCapaUrl: 'https://exemplo.com/capa.jpg',
    };

    const campanha = {
      id: 'camp-1',
      titulo: 'Horta Comunitária do Campus',
      descricao: 'Projeto de extensão para plantio de hortaliças.',
      tema: 'comunitario',
      palavrasChave: 'agricultura, horta',
      categoria: { nome: 'Sustentabilidade' },
      autor: { nome: 'Fulano de Tal', instituicao: 'IFSP' },
      status: 'ativa',
      imagemCapaUrl: 'https://exemplo.com/horta.jpg',
      metaFinanceira: 987654.32,
      valorArrecadado: 123456.78,
    };

    const docArtigo = montarDocumentoArtigo(artigo);
    const chunksArtigo = dividirDocumento(docArtigo);

    const docCampanha = montarDocumentoCampanha(campanha);
    const chunksCampanha = dividirDocumento(docCampanha);

    const todosOsTextos = [...chunksArtigo, ...chunksCampanha].map((c) => c.texto).join(' ');

    expect(todosOsTextos).not.toContain('Fulano');
    expect(todosOsTextos).not.toContain('IFSP');
    expect(todosOsTextos).not.toContain('987654');
    expect(todosOsTextos).not.toContain('123456');
    expect(todosOsTextos).not.toContain('https://exemplo.com');
  });

  test('10. campos nulos/ausentes não produzem "undefined" nem "null" no texto', () => {
    const artigoIncompleto = {
      id: 'art-2',
      titulo: 'Publicação Simples',
      conteudo: 'Apenas conteúdo básico sem resumo nem tema.',
      resumo: null,
      tema: undefined,
      palavrasChave: null,
      categoria: null,
    };

    const doc = montarDocumentoArtigo(artigoIncompleto);
    const chunks = dividirDocumento(doc);

    for (const c of chunks) {
      expect(c.texto).not.toContain('undefined');
      expect(c.texto).not.toContain('null');
      expect(c.texto).not.toContain('Resumo:');
      expect(c.texto).not.toContain('Tema:');
      expect(c.texto).not.toContain('Palavras-chave:');
      expect(c.texto).not.toContain('Categoria:');
    }
  });

  test('11. dividirDocumento: chunkIndex 0..n-1; todo chunk começa com "Título: ..."; só o chunk 0 contém metadados', () => {
    const doc = {
      sourceType: 'artigo',
      sourceId: 'art-3',
      titulo: 'Título do Artigo Longo',
      metadados: {
        resumo: 'Resumo presente',
        categoria: 'Engenharia',
        tema: 'educacional',
        palavrasChave: 'eletrônica, circuitos',
      },
      corpo: 'Frase de conteúdo que será repetida para gerar múltiplos chunks. '.repeat(40),
    };

    const chunks = dividirDocumento(doc, { tamanho: 400, sobreposicao: 50 });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, idx) => {
      expect(chunk.chunkIndex).toBe(idx);
      expect(chunk.texto.startsWith('Título: Título do Artigo Longo')).toBe(true);

      if (idx === 0) {
        expect(chunk.texto).toContain('Resumo: Resumo presente');
        expect(chunk.texto).toContain('Categoria: Engenharia');
        expect(chunk.texto).toContain('Tema: educacional');
        expect(chunk.texto).toContain('Palavras-chave: eletrônica, circuitos');
      } else {
        expect(chunk.texto).not.toContain('Resumo:');
        expect(chunk.texto).not.toContain('Categoria:');
        expect(chunk.texto).not.toContain('Tema:');
        expect(chunk.texto).not.toContain('Palavras-chave:');
      }
    });
  });

  test('12. hashDocumento: 64 caracteres hex; determinístico; muda se título, corpo, metadados ou parâmetros mudarem', () => {
    const docBase = {
      titulo: 'Título Base',
      corpo: 'Corpo Base',
      metadados: { tema: 'cientifico', categoria: 'Física' },
    };

    const hash1 = hashDocumento(docBase);
    const hash2 = hashDocumento(docBase);

    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);

    const hashTituloDiferente = hashDocumento({ ...docBase, titulo: 'Outro Título' });
    expect(hashTituloDiferente).not.toBe(hash1);

    const hashCorpoDiferente = hashDocumento({ ...docBase, corpo: 'Outro Corpo' });
    expect(hashCorpoDiferente).not.toBe(hash1);

    const hashMetaDiferente = hashDocumento({ ...docBase, metadados: { tema: 'cultural' } });
    expect(hashMetaDiferente).not.toBe(hash1);

    const hashTamanhoDiferente = hashDocumento(docBase, { tamanho: 500 });
    expect(hashTamanhoDiferente).not.toBe(hash1);
  });

  test('13. aceita objeto estilo Sequelize (um objeto com get() que devolve o objeto simples)', () => {
    const mockSequelize = {
      get(opcoes) {
        if (opcoes?.plain) {
          return {
            id: 'art-seq-1',
            titulo: 'Artigo vindo do Sequelize',
            resumo: 'Resumo do model',
            conteudo: 'Conteúdo plain',
            tipo: 'texto',
            tema: 'cultural',
            categoria: { nome: 'Literatura' },
            autor: { nome: 'Professor Moderador' },
          };
        }
      },
    };

    const doc = montarDocumentoArtigo(mockSequelize);
    expect(doc.sourceId).toBe('art-seq-1');
    expect(doc.titulo).toBe('Artigo vindo do Sequelize');
    expect(doc.metadados.resumo).toBe('Resumo do model');
    expect(doc.metadados.categoria).toBe('Literatura');
    expect(doc.metadados.tema).toBe('cultural');
    expect(doc.corpo).toBe('Conteúdo plain');

    const chunks = dividirDocumento(doc);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].texto).not.toContain('Professor Moderador');
  });
});

