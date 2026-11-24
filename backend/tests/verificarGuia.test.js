const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  verificarDiretorio,
  verificarArquivoMarkdown,
  formatarTabelaFalhas,
} = require('../scripts/verificar-guia');

describe('Verificador de links da documentação de apresentação (verificar-guia.js)', () => {
  let tmpDir;
  let srcDir;
  let docDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifconnect-guia-'));
    srcDir = path.join(tmpDir, 'src');
    docDir = path.join(tmpDir, 'docs', 'apresentacao');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(docDir, { recursive: true });

    const codigoExemplo = [
      'const LIMITE = 10;',
      '',
      'function somarValores(a, b) {',
      '  return a + b;',
      '}',
      '',
      'module.exports = { LIMITE, somarValores };',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(srcDir, 'exemplo.js'), codigoExemplo, 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('aprova arquivo existente, símbolo presente no intervalo (e tolerância ±3) e link sem âncora', () => {
    const md = [
      '# Guia Teste',
      '- Arquivo inteiro sem âncora: [`exemplo.js`](../../src/exemplo.js)',
      '- Pasta existente: [`src`](../../src)',
      '- Função no intervalo exato: [`somarValores`](../../src/exemplo.js#L3-L5)',
      '- Constante na tolerância de 3 linhas: [`LIMITE`](../../src/exemplo.js#L3-L4)',
      '- Link externo ignorado: [Demo](https://ifconnect.onrender.com/)',
      '- Âncora interna ignorada: [Topo](#guia-teste)',
    ].join('\n');

    const caminhoMd = path.join(docDir, 'guia.md');
    fs.writeFileSync(caminhoMd, md, 'utf8');

    const res = verificarDiretorio(docDir);
    expect(res.totalVerificados).toBe(4);
    expect(res.totalFalhas).toBe(0);
    expect(res.falhas).toEqual([]);
  });

  test('detecta arquivo inexistente', () => {
    const caminhoMd = path.join(docDir, 'quebrado.md');
    fs.writeFileSync(caminhoMd, 'Veja [`naoExiste`](../../src/inexistente.js#L1-L3).', 'utf8');

    const res = verificarArquivoMarkdown(caminhoMd);
    expect(res.verificados).toBe(1);
    expect(res.falhas).toHaveLength(1);
    expect(res.falhas[0].motivo).toMatch(/não existe/i);
  });

  test('detecta linha fora do intervalo do arquivo e intervalo invertido (x > y)', () => {
    const caminhoMd = path.join(docDir, 'linhas.md');
    fs.writeFileSync(
      caminhoMd,
      [
        '- Fora do fim: [`somarValores`](../../src/exemplo.js#L3-L99)',
        '- Invertido: [`somarValores`](../../src/exemplo.js#L5-L3)',
      ].join('\n'),
      'utf8'
    );

    const res = verificarArquivoMarkdown(caminhoMd);
    expect(res.verificados).toBe(2);
    expect(res.falhas).toHaveLength(2);
    expect(res.falhas[0].motivo).toMatch(/fora do intervalo/i);
    expect(res.falhas[1].motivo).toMatch(/Intervalo inválido/i);
  });

  test('detecta símbolo ausente no intervalo e formata tabela de falhas', () => {
    const caminhoMd = path.join(docDir, 'simbolo.md');
    fs.writeFileSync(
      caminhoMd,
      'Função errada: [`funcaoQueNaoExiste`](../../src/exemplo.js#L1-L7)',
      'utf8'
    );

    const res = verificarArquivoMarkdown(caminhoMd, 'simbolo.md');
    expect(res.verificados).toBe(1);
    expect(res.falhas).toHaveLength(1);
    expect(res.falhas[0].motivo).toMatch(/funcaoQueNaoExiste/);

    const tabela = formatarTabelaFalhas(res.falhas);
    expect(tabela).toContain('simbolo.md');
    expect(tabela).toContain('funcaoQueNaoExiste');
  });
});
