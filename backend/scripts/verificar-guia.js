/**
 * Verifica todos os links relativos nos arquivos Markdown de docs/apresentacao/.
 * Uso (a partir de backend/): npm run guia:verificar
 */
const fs = require('fs');
const path = require('path');

const REGEX_LINK_MD = /(!?)\[([^\]]+)\]\(([^)]+)\)/g;
const REGEX_ANCORA_LINHA = /^L(\d+)(?:-L(\d+))?$/;
const REGEX_CRASES_IDENTIFICADOR = /^`([^`\s]+)`$/;

function lerLinhasArquivo(caminhoArquivo) {
  const conteudo = fs.readFileSync(caminhoArquivo, 'utf8');
  if (conteudo.length === 0) return [];
  const brutas = conteudo.split(/\r?\n/);
  return conteudo.endsWith('\n') ? brutas.slice(0, -1) : brutas;
}

function ehLinkExternoOuAncoraPura(destino) {
  const d = destino.trim();
  return (
    !d ||
    d.startsWith('#') ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(d) ||
    d.startsWith('//')
  );
}

/**
 * Verifica os links relativos de um único arquivo Markdown.
 * @param {string} caminhoMd Caminho absoluto do arquivo .md
 * @param {string} [nomeExibicao] Nome curto para exibição nos relatórios
 * @returns {{ documento: string, verificados: number, falhas: Array<{ documento: string, link: string, motivo: string }> }}
 */
function verificarArquivoMarkdown(caminhoMd, nomeExibicao = path.basename(caminhoMd)) {
  const linhasMd = lerLinhasArquivo(caminhoMd);
  const dirBase = path.dirname(caminhoMd);
  const falhas = [];
  let verificados = 0;
  let emBlocoCodigo = false;

  for (let i = 0; i < linhasMd.length; i += 1) {
    const linha = linhasMd[i];
    if (/^\s*`{3,}/.test(linha)) {
      emBlocoCodigo = !emBlocoCodigo;
      continue;
    }
    if (emBlocoCodigo) continue;

    REGEX_LINK_MD.lastIndex = 0;
    let match;
    while ((match = REGEX_LINK_MD.exec(linha)) !== null) {
      const [, prefixoImagem, textoLink, destinoBruto] = match;
      if (prefixoImagem === '!') continue;

      const destino = destinoBruto.trim();
      if (ehLinkExternoOuAncoraPura(destino)) continue;

      verificados += 1;
      const reprLink = `[${textoLink}](${destino})`;

      const idxHash = destino.indexOf('#');
      const parteCaminho = idxHash === -1 ? destino : destino.slice(0, idxHash);
      const ancora = idxHash === -1 ? '' : destino.slice(idxHash + 1);

      const caminhoAlvo = path.resolve(dirBase, parteCaminho);
      if (!fs.existsSync(caminhoAlvo)) {
        falhas.push({
          documento: nomeExibicao,
          link: reprLink,
          motivo: 'Arquivo ou pasta não existe',
        });
        continue;
      }

      if (!ancora) continue;

      const matchLinha = REGEX_ANCORA_LINHA.exec(ancora);
      if (!matchLinha) {
        if (/^L/i.test(ancora)) {
          falhas.push({
            documento: nomeExibicao,
            link: reprLink,
            motivo: `Âncora de linha inválida: #${ancora}`,
          });
        }
        continue;
      }

      const stat = fs.statSync(caminhoAlvo);
      if (!stat.isFile()) {
        falhas.push({
          documento: nomeExibicao,
          link: reprLink,
          motivo: 'Âncora de linha apontando para diretório',
        });
        continue;
      }

      const x = Number(matchLinha[1]);
      const y = matchLinha[2] !== undefined ? Number(matchLinha[2]) : x;

      if (x < 1 || x > y) {
        falhas.push({
          documento: nomeExibicao,
          link: reprLink,
          motivo: `Intervalo inválido (#L${x}-L${y}: x deve ser >= 1 e <= y)`,
        });
        continue;
      }

      const linhasAlvo = lerLinhasArquivo(caminhoAlvo);
      const totalLinhas = linhasAlvo.length;

      if (y > totalLinhas) {
        falhas.push({
          documento: nomeExibicao,
          link: reprLink,
          motivo: `Linha fora do intervalo do arquivo (solicitado até L${y}, arquivo tem ${totalLinhas} linhas)`,
        });
        continue;
      }

      const matchIdent = REGEX_CRASES_IDENTIFICADOR.exec(textoLink.trim());
      if (matchIdent) {
        const identificador = matchIdent[1];
        const inicioJanela = Math.max(1, x - 3);
        const fimJanela = Math.min(totalLinhas, y + 3);
        const fatia = linhasAlvo.slice(inicioJanela - 1, fimJanela);
        const encontrado = fatia.some((l) => l.includes(identificador));

        if (!encontrado) {
          falhas.push({
            documento: nomeExibicao,
            link: reprLink,
            motivo: `Identificador "${identificador}" não encontrado nas linhas L${inicioJanela}-L${fimJanela}`,
          });
        }
      }
    }
  }

  return { documento: nomeExibicao, verificados, falhas };
}

/**
 * Verifica todos os arquivos .md de um diretório.
 * @param {string} diretorio Caminho absoluto do diretório com os arquivos .md
 */
function verificarDiretorio(diretorio) {
  if (!fs.existsSync(diretorio)) {
    throw new Error(`Diretório não encontrado: ${diretorio}`);
  }

  const arquivos = fs
    .readdirSync(diretorio)
    .filter((nome) => nome.toLowerCase().endsWith('.md'))
    .sort();

  const porDocumento = [];
  const todasFalhas = [];
  let totalVerificados = 0;

  for (const nome of arquivos) {
    const caminhoCompleto = path.join(diretorio, nome);
    if (!fs.statSync(caminhoCompleto).isFile()) continue;
    const resultado = verificarArquivoMarkdown(caminhoCompleto, nome);
    porDocumento.push({ documento: nome, verificados: resultado.verificados, falhas: resultado.falhas.length });
    totalVerificados += resultado.verificados;
    todasFalhas.push(...resultado.falhas);
  }

  return {
    porDocumento,
    totalVerificados,
    totalFalhas: todasFalhas.length,
    falhas: todasFalhas,
  };
}

function formatarTabelaFalhas(falhas) {
  if (!falhas.length) return '';
  const cabecalho = 'Documento | Link | Motivo\n--- | --- | ---';
  const linhas = falhas.map((f) => `${f.documento} | ${f.link} | ${f.motivo}`);
  return [cabecalho, ...linhas].join('\n');
}

function executarCli() {
  const dirApresentacao = path.resolve(__dirname, '../../docs/apresentacao');
  const resultado = verificarDiretorio(dirApresentacao);

  for (const item of resultado.porDocumento) {
    console.log(`- ${item.documento}: ${item.verificados} links verificados (${item.falhas} falhas)`);
  }

  if (resultado.totalFalhas > 0) {
    console.error('\nFalhas encontradas:\n');
    console.error(formatarTabelaFalhas(resultado.falhas));
    console.error(`\n${resultado.totalVerificados} links verificados, ${resultado.totalFalhas} falhas`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n${resultado.totalVerificados} links verificados, 0 falhas`);
}

if (require.main === module) {
  try {
    executarCli();
  } catch (err) {
    console.error(`[guia:verificar] Erro: ${err.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  verificarDiretorio,
  verificarArquivoMarkdown,
  formatarTabelaFalhas,
  lerLinhasArquivo,
};
