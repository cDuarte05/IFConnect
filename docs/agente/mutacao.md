# Relatório de Teste de Mutação (Stryker) — Módulo do Agente RAG

- **Data:** 2026-11-11
- **Comando executado:** `npm run agente:mutacao` (em `backend/`)
- **Configuração:** [`backend/stryker.config.json`](../../backend/stryker.config.json) (`@stryker-mutator/core` / `@stryker-mutator/jest-runner`, `coverageAnalysis: "perTest"`, `testMatch: ["**/tests/agente/**/*.test.js"]`, `concurrency: 2`, thresholds `{ high: 80, low: 60, break: null }`)
- **Total de mutantes instrumentados:** 522

---

## 1. Score Final por Arquivo

| Arquivo | Baseline (1ª execução) | Score Final (2ª execução) | Total (%) | Covered (%) | Killed | Timeout | Survived | No Coverage | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `src/services/agente/generation/citacoes.js` | 95,37% | **98,15%** | 98,15% | 99,07% | 106 | 0 | 1 | 1 | 0 |
| `src/services/agente/generation/intencao.js` | 93,10% | **93,10%** | 93,10% | 93,10% | 25 | 2 | 2 | 0 | 0 |
| `src/services/agente/generation/prompt.js` | 87,10% | **99,19%** | 99,19% | 99,19% | 123 | 0 | 1 | 0 | 0 |
| `src/services/agente/retrieval/hybrid.js` | 73,95% | **88,89%** | 88,89% | 88,89% | 230 | 2 | 29 | 0 | 0 |
| **Total (All files)** | **82,57%** | **93,49%** | **93,49%** | **93,67%** | **484** | **4** | **33** | **1** | **0** |

> Todos os arquivos atingiram score acima do limiar alto (`80%`). Em particular, `hybrid.js` subiu de `73,95%` para `88,89%` e `prompt.js` de `87,10%` para `99,19%`.

---

## 2. Mutantes Mortos por Novos Testes (entre a 1ª e a 2ª execução)

- [`backend/tests/agente/citacoes.test.js`](../../backend/tests/agente/citacoes.test.js) (teste 11):
  - Cobertura de `refsValidas` como `Set` e `null`/`undefined` em `processarCitacoes` (matou 4 mutantes `NoCoverage` na linha 38 de `citacoes.js`).
- [`backend/tests/agente/ragService.test.js`](../../backend/tests/agente/ragService.test.js) (teste 13):
  - Chamadas a `ehPerguntaDeNavegacao(123)` e `ehPerguntaDeNavegacao('   ')` (matou o mutante `if (false)` na linha 32 de `intencao.js`).
- [`backend/tests/agente/prompt.test.js`](../../backend/tests/agente/prompt.test.js) (testes 7 a 10):
  - `escaparTags` e `sanitizarPergunta` com valores não-string (`null`, `123`) e strings vazias (matou mutantes nas linhas 25 e 33).
  - `truncarTrecho`: corte no último espaço (`'palavra1 palavra2 palavra3'`), corte duro sem espaços (`'abcdefghij'`), espaço exatamente no índice 0 (`' abcdefghij'`) e trecho vazio (matou mutantes nas linhas 43, 45, 46 e 47).
  - Estouro de orçamento (`maxTotal`): fonte pequena após fonte que estourou `maxTotal` (matou `charsAcumulados = maxTotal - 1` na linha 79).
  - Fontes nulas, `trechos` não-array (`null`), item objeto vazio `{}` e `tipoPublicacao` definido com `tipo !== 'publicacao'` (matou mutantes nas linhas 69, 73 e 96).
- [`backend/tests/agente/retrieval.hybrid.test.js`](../../backend/tests/agente/retrieval.hybrid.test.js) (testes 3 unitário, 12 e 13):
  - `fundirRrf`: aceitação de IDs como `string`, itens `null`/`undefined`/`{ chunkId: null }` e duplicata do mesmo `chunkId` na mesma lista (matou mutantes nas linhas 42, 43 e 52).
  - `montarFonte` / `carregarFontesPublicas`: validação explícita de `status` em publicação, `categoria` e `tema` em campanha (e `null` quando ausentes) (matou mutantes nas linhas 81, 102, 110 e 111).
  - `recuperar`: provider rejeitando sem `.message` (`vetorialErro === 'falha desconhecida'`), `descartadosPorStatus === 0` no fallback lexical (matou linha 144 e 163), `Article.findAll`/`Campaign.findAll` não chamados sem candidatos do respectivo tipo (matou linhas 66, 67), `descartadosPorRelevancia === 1` com candidato misto (matou linha 203), cálculo e ordenação RRF (`fundirRrf([lexical, vetorial])`, `cosseno` preenchido, `trechos` com `{ chunkIndex, texto }` ordenados por `chunkIndex` mesmo quando chunk 1 pontua mais que chunk 0, e agregação `cobertura`/`rrf` multi-chunk) (matou mutantes nas linhas 149, 165, 182, 207, 237, 238, 242 e 246).

---

## 3. Lista Completa dos Mutantes Restantes (34) e Justificativa

### 3.1 `src/services/agente/generation/citacoes.js` (2)

1. **`citacoes.js:47:48` [NoCoverage] `ArrayDeclaration`**: `bloco.match(/\d{1,2}/g) || []` → `["Stryker was here"]`
   - **Equivalente:** a regex `regexBlocoMarcadores` exige a presença de `\d{1,2}` dentro de cada `bloco` casado; portanto `bloco.match(/\d{1,2}/g)` nunca retorna `null`.
2. **`citacoes.js:38:88` [Survived] `ArrayDeclaration`**: `refsValidas || []` → `["Stryker was here"]`
   - **Equivalente:** `setValidas` só é consultado com `setValidas.has(num)`, onde `num` é um inteiro obtido via `parseInt(numStr, 10)`; a string `"Stryker was here"` no `Set` nunca casa com um `number`.

### 3.2 `src/services/agente/generation/intencao.js` (2)

3. **`intencao.js:32:40` [Survived] `MethodExpression`**: `!pergunta.trim()` → `!pergunta`
   - **Equivalente:** quando `pergunta` é uma string contendo apenas espaços (`"   "`), `normalizar(pergunta)` preserva os espaços, não casa `REGEX_COMO`, e `split(/[^a-z0-9]+/)` gera apenas strings vazias `""`, ausentes de `TERMOS_NAVEGACAO` — retornando `false` nos dois casos.
4. **`intencao.js:37:22` [Survived] `Regex`**: `/[^a-z0-9]+/` → `/[^a-z0-9]/`
   - **Equivalente:** `TERMOS_NAVEGACAO` não contém `""`, logo tokens vazios produzidos entre separadores consecutivos não afetam `.some((token) => TERMOS_NAVEGACAO.has(token))`.

### 3.3 `src/services/agente/generation/prompt.js` (1)

5. **`prompt.js:113:37` [Survived] `BlockStatement`**: `if (charsAcumulados > maxTotal) { break; }` → `{}`
   - **Equivalente:** ao estourar `maxTotal`, a linha 79 define `charsAcumulados = maxTotal + 1`. Para todas as fontes seguintes do laço externo, qualquer trecho não-nulo (`tamanhoTrecho >= 0`) faz `charsAcumulados + tamanhoTrecho > maxTotal`, interrompendo o laço interno com `trechosProcessados.length === 0` e impedindo qualquer inclusão. O `break` externo é apenas saída antecipada equivalente.

### 3.4 `src/services/agente/retrieval/hybrid.js` (29)

6. **`hybrid.js:36:50` [Survived] `ArrayDeclaration`**: `Array.isArray(listas) ? listas : []` → `["Stryker was here"]`
   - **Equivalente:** o `todas.forEach` inicia com `if (!Array.isArray(lista)) return;`, descartando o elemento string e devolvendo um `Map` vazio idêntico.
7. **`hybrid.js:76:9` [Survived] `ArrayDeclaration`**: `idsArtigos.length ? ... : []` → `: ["Stryker was here"]`
   - **Equivalente:** `new Map(["Stryker was here"].map((a) => [a.id, a]))` mapeia `undefined => "Stryker was here"`. Como todo `c.sourceId` válido é UUID string, `fontesBanco.artigos.has(c.sourceId)` retorna sempre `false`.
8. **`hybrid.js:83:9` [Survived] `ArrayDeclaration`**: `idsCampanhas.length ? ... : []` → `: ["Stryker was here"]`
   - **Equivalente:** mesma razão do item 7 para `fontesBanco.campanhas`.
9. **`hybrid.js:133:49` [Survived] `ObjectLiteral`**: `buscarLexical(pergunta, { k: CANDIDATOS_POR_RAMO })` → `buscarLexical(pergunta, {})`
   - **Equivalente:** em `lexical.js:61`, o parâmetro padrão já é `k = 20`, igual a `CANDIDATOS_POR_RAMO = 20`.
10. **`hybrid.js:182:10` [Survived] `OptionalChaining`**: `fundidos.get(c.chunkId)?.rrf` → `fundidos.get(c.chunkId).rrf`
    - **Equivalente:** `candidatosMap` é construído exclusivamente com `chunkId`s oriundos de `lexical` e `vetorial`, logo todo `c.chunkId` existe em `fundidos`.
11. **`hybrid.js:199:45` [Survived] `ConditionalExpression`**: `minScore !== undefined` → `true`
    - **Equivalente** sob os tipos aceitos por `config`: `minScore` vem de `config.rag.minScore` (`number | null`) ou parâmetro explícito nos testes; `undefined` só ocorreria se passado explicitamente como `{ minScore: undefined }` fora do default.
12. **`hybrid.js:199:71` [Survived] `ConditionalExpression`**: `c.cosseno !== null` → `true`
    - **Equivalente parcial / fronteira:** se `minScore > 0` (caso real de calibração), em JS `null >= minScore` é `0 >= minScore === false`. Só divergiria se `minScore <= 0` com `c.cosseno === null`.
13. **`hybrid.js:199:93` [Survived] `EqualityOperator`**: `c.cosseno >= minScore` → `c.cosseno > minScore`
    - **Fronteira de igualdade exata:** nos testes existentes nenhum chunk tem cosseno exatamente igual a `minScore` (`c.cosseno === minScore`), ponto de fronteira aberta vs. fechada no corte de relevância.
14. **`hybrid.js:200:26` [Survived] `LogicalOperator`**: `c.cobertura !== null && c.cobertura > 0` → `c.cobertura !== null || c.cobertura > 0`
    - **Equivalente** para saídas de `buscarLexical` e `buscarVetorial`: itens vindos do ramo lexical sempre possuem `cobertura > 0` (pois `buscarLexical` filtra `score > 0`), e itens apenas vetoriais têm `cobertura === null` (em JS `null > 0` é `false`).
15. **`hybrid.js:200:50` [Survived] `ConditionalExpression`**: `c.cobertura !== null && c.cobertura > 0` → `c.cobertura !== null && true`
    - **Equivalente** sob saídas de `buscarLexical`: todo resultado retornado por `buscarLexical` possui ao menos 1 termo casado (`cobertura > 0`), nunca `cobertura === 0`.
16. **`hybrid.js:200:50` [Survived] `EqualityOperator`**: `c.cobertura > 0` → `c.cobertura >= 0`
    - **Equivalente** sob saídas de `buscarLexical`: `cobertura` é sempre estritamente maior que `0` para candidatos do ramo lexical.
17. **`hybrid.js:206:3` [Survived] `MethodExpression`**: remoção do `candidatos.sort(...)`
18. **`hybrid.js:206:29` [Survived] `BlockStatement`**: `candidatos.sort((a, b) => {})`
19. **`hybrid.js:207:9` [Survived] `ConditionalExpression`**: `if (false) return b.rrf - a.rrf;`
20. **`hybrid.js:207:33` [Survived] `ArithmeticOperator`**: `return b.rrf + a.rrf;`
    - **Itens 17 a 20 (ordenação de `candidatos`):** nos cenários dos testes de integração com `buscarLexical`, o próprio `buscarLexical` já devolve os candidatos em ordem decrescente de BM25 (`c1`, `c0`, `a2`), e os vetores do `storeFake` reforçam a mesma ordem em `candidatosMap`. Como `Map` preserva ordem de inserção, `candidatos` já entra na ordem final antes de `.sort(...)`, e `b.rrf + a.rrf > 0` mantém essa ordem inicial quando o array já está ordenado.
21. **`hybrid.js:239:11` [Survived] `ConditionalExpression`**: `if (false) grupo.cosseno = c.cosseno;`
22. **`hybrid.js:239:11` [Survived] `ConditionalExpression`**: `if (true && ...)`
23. **`hybrid.js:239:11` [Survived] `EqualityOperator`**: `c.cosseno === null && ...`
24. **`hybrid.js:239:34` [Survived] `LogicalOperator`**: `grupo.cosseno === null && c.cosseno > grupo.cosseno`
25. **`hybrid.js:239:34` [Survived] `ConditionalExpression`**: `false || c.cosseno > grupo.cosseno`
26. **`hybrid.js:239:60` [Survived] `ConditionalExpression`**: `grupo.cosseno === null || false`
27. **`hybrid.js:239:60` [Survived] `EqualityOperator`**: `c.cosseno >= grupo.cosseno`
    - **Itens 21 a 27 (atualização de `grupo.cosseno` no ramo `else`):** o item `27` (`>=` vs `>`) é **estritamente equivalente** (atribuir um valor igual ao atual é no-op). Os itens `21` a `26` sobreviveram porque, nos dois cenários do teste 13b, o primeiro chunk da fonte selecionado por maior `rrf` já possuía o maior `cosseno` (`0.95` vs `0.40` e `0.90` vs `0.25`), não ocorrendo no mesmo teste um 2º chunk com `rrf` menor e `cosseno` maior (ou 1º chunk com `cosseno === null` e 2º não-nulo).
28. **`hybrid.js:240:11` [Survived] `ConditionalExpression`**: `if (true) grupo.cobertura = c.cobertura;`
29. **`hybrid.js:240:11` [Survived] `LogicalOperator`**: `c.cobertura !== null || ...`
30. **`hybrid.js:240:11` [Survived] `ConditionalExpression`**: `true && ...`
31. **`hybrid.js:240:36` [Survived] `ConditionalExpression`**: `c.cobertura !== null && (true)`
32. **`hybrid.js:240:36` [Survived] `ConditionalExpression`**: `false || c.cobertura > grupo.cobertura`
33. **`hybrid.js:240:36` [Survived] `EqualityOperator`**: `grupo.cobertura !== null || ...`
34. **`hybrid.js:240:64` [Survived] `EqualityOperator`**: `c.cobertura >= grupo.cobertura`
    - **Itens 28 a 34 (atualização de `grupo.cobertura` no ramo `else`):** o item `34` (`>=` vs `>`) é **estritamente equivalente** (no-op quando igual). Os itens `28` a `33` sobreviveram porque, no teste 13b (`resInverso`), o 2º chunk possuía exatamente `cobertura` estritamente maior que o 1º (`1.0 > 0.5`), sem um terceiro caso em que o 2º chunk tivesse `cobertura === null` ou `cobertura` menor que o 1º.

