# ADR-0002: Separação de Provedores (Embedding vs. LLM), Variáveis e Degradação

- **Status:** Aprovada
- **Data:** 2026-11-11
- **Relacionado:** [`spec-rag.md`](./spec-rag.md) (D5, D7, Seções 10 e 11, RF-05, RF-09, RF-13, RF-14) e [`adr-0001-rag-vetores-em-tabela.md`](./adr-0001-rag-vetores-em-tabela.md)

---

## Contexto

Na versão anterior do módulo do agente (`agenteService.js`), o portal já definia variáveis `AGENTE_IA_*` no `.env.example` para o modelo de linguagem (`anthropic`, `gemini`, `groq`). Ao evoluir para RAG, surgiram dois desafios:

1. Nem todo provedor de LLM configurado para geração oferece API de embeddings (ex.: Groq e Anthropic não fornecem endpoint de embeddings equivalente no mesmo contrato).
2. A geração e o embedding têm perfis de latência, cota e tolerância a falhas distintos: uma lentidão na geração de embedding da pergunta não deve travar o visitante nem derrubar o retorno da API.

---

## Decisão

1. **Separar o provedor de embedding do provedor de LLM (D5):**
   - `AGENTE_IA_PROVIDER` / `AGENTE_IA_API_KEY` / `AGENTE_IA_MODEL` controlam exclusivamente o LLM de geração (`anthropic`, `gemini`, `groq`).
   - `AGENTE_RAG_EMBEDDING_PROVIDER` / `AGENTE_RAG_EMBEDDING_MODEL` / `AGENTE_RAG_EMBEDDING_DIM` / `AGENTE_RAG_EMBEDDING_API_KEY` controlam os embeddings, com fallback automático de `AGENTE_IA_API_KEY` apenas quando `AGENTE_IA_PROVIDER=gemini` e a chave dedicada de embedding estiver vazia.
2. **Estender as variáveis de ambiente (`AGENTE_RAG_*`):**
   - As novas variáveis `AGENTE_RAG_*` estendem o conjunto `AGENTE_IA_*` previsto no documento de Análise de Viabilidade, todas lidas dinamicamente via `getConfig()` ([`backend/src/services/agente/config.js`](../../backend/src/services/agente/config.js)) e documentadas em [`backend/.env.example`](../../backend/.env.example).
3. **Padrão de embedding com Gemini no plano gratuito e falha rápida na consulta:**
   - Modelo padrão: `gemini-embedding-001` com `768` dimensões (`outputDimensionality`) e normalização L2 local após truncamento.
   - No caminho da pergunta (`embedQuery`), usa-se timeout curto (`TIMEOUT_EMBED_QUERY_MS = 3000` ms) e **nenhum retry**: se o provedor responder 429/5xx ou der timeout, o `hybrid.js` captura o erro e degrada silenciosamente para recuperação apenas lexical (`modo: 'lexical'`), mantendo a resposta do LLM em `modo: 'rag'`.
   - Na ingestão offline/background (`embedDocuments`), o envio ocorre em lotes de até `50` textos (`LIMITE_LOTE`) com backoff e respeito a `Retry-After` (até `10000` ms).
   - Em testes automatizados e validação offline, usa-se o provedor determinístico `mock` (64 dimensões) sem rede.
4. **Interruptor *strangler* (`AGENTE_RAG_ENABLED`):**
   - Padrão `false`: quando desligado (ou quando a recuperação RAG lançar erro inesperado), `agenteService.responder()` executa integralmente o fluxo legado (RF-14), garantindo rollback imediato sem alteração de código.

---

## Alternativas Rejeitadas

1. **Exigir o mesmo provedor para LLM e embedding:** rejeitada porque impediria continuar usando `groq` ou `anthropic` na geração de respostas.
2. **Fazer retry com backoff exponencial durante `POST /api/agente/consulta`:** rejeitada porque multiplicaria a latência percebida pelo visitante em cenários de `429`/instabilidade da cota gratuita, quando o ramo lexical BM25 já entrega recuperação funcional imediata.
3. **Substituir o fluxo legado diretamente sem feature flag:** rejeitada por aumentar o risco em demonstrações/produção; manter `AGENTE_RAG_ENABLED` preserva um plano de contingência instantâneo.

---

## Consequências

- **Positivas:**
  - Flexibilidade para combinar LLM rápido (ex.: Groq) com embedding Gemini gratuito ou `mock` em testes.
  - Alta resiliência: falha no embedding não derruba o RAG; falha no LLM cai em modo `busca`; `AGENTE_RAG_ENABLED=false` restaura o comportamento legado.
- **Negativas / Pontos de atenção:**
  - Requer gerenciar até duas chaves de API quando o LLM não for Gemini.
  - Em uso real com cota gratuita do Gemini, `npm run agente:reindex` deve respeitar `--delay-ms` entre fontes para evitar rate limit do provedor.

