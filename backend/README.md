# Backend — IFConnect

API REST em Node.js/Express (CommonJS) com Sequelize que sustenta o portal: publicações, vitrine de projetos, apoios, comentários em tempo real (SSE), ajuda dinâmica e Assistente de IA (RAG).

## Rodando localmente

> **Atenção:** O comando `npm run seed` recria o banco de dados do zero (`sync({ force: true })`), apagando todas as tabelas, inclusive o índice do assistente (`agente_chunks`).

```bash
cd backend
npm install
cp .env.example .env
npm run seed   # cria banco SQLite local com dados fictícios
npm run dev    # inicia em http://localhost:4000
```

> **Windows PowerShell:** use `Copy-Item .env.example .env` no lugar de `cp`. Se `npm` estiver bloqueado por política de execução, use `npm.cmd` ou Git Bash.

## Rotas e configuração

- **Rotas da API (`/api`):** a tabela completa de endpoints e níveis de acesso está em [`docs/api.md`](../docs/api.md).
- **Variáveis de ambiente:** a referência completa (incluindo `AGENTE_IA_*`, `AGENTE_RAG_*`, `DATABASE_URL` e `PORT`/`API_PORT`) está em [`docs/configuracao.md`](../docs/configuracao.md).
- **Modelo de dados:** diagrama ER e descrição das tabelas (incluindo `agente_chunks`) em [`docs/modelo-de-dados.md`](../docs/modelo-de-dados.md).

Contas `professor_moderador` não são criadas por autocadastro — use `npm run seed` localmente ou promova via banco.

## Assistente de IA (RAG)

O assistente responde dúvidas em português do Brasil sobre conteúdos **públicos** (`publicado` e `ativa`/`financiada`), além de orientar sobre navegação usando [`src/config/limites.js`](src/config/limites.js).

- **Especificação e decisões:** [`docs/agente/spec-rag.md`](../docs/agente/spec-rag.md), [`ADR-0001`](../docs/agente/adr-0001-rag-vetores-em-tabela.md) e [`ADR-0002`](../docs/agente/adr-0002-provedores-e-configuracao.md).
- **Indexação em lote (`agente_chunks`):** `npm run agente:reindex` (flags opcionais: `--dry-run`, `--force`, `--delay-ms=N`).
- **Avaliação offline de recuperação:** `npm run agente:eval` (resultados com provedor real em [`docs/agente/avaliacao.md`](../docs/agente/avaliacao.md)).
- **Smoke test HTTP:** `npm run agente:smoke` (contra `BASE_URL`, padrão `http://localhost:4000`).
- **Teste de mutação (Stryker):** `npm run agente:mutacao` — `93,49%` em [`docs/agente/mutacao.md`](../docs/agente/mutacao.md).
- **Degradação:** `AGENTE_RAG_ENABLED=false` restaura o fluxo legado; `AGENTE_IA_API_KEY` vazia ativa modo `busca`; `AGENTE_IA_ENABLED=false` desliga o assistente (`503`).

## Testes

```bash
npm test
```

Os testes usam Jest + Supertest com SQLite em memória (`:memory:`, ignorando `DATABASE_URL`) e provedores externos mockados (`global.fetch` e `mock`), sem acesso à rede. A matriz de cobertura está em [`docs/agente/cobertura-ca.md`](../docs/agente/cobertura-ca.md).

## Banco na nuvem (Supabase) e hospedagem (Render)

1. Crie um projeto no [Supabase](https://supabase.com) e copie a string do **Session pooler** (porta `5432`).
2. Configure `DATABASE_URL` no ambiente de produção (nunca versione `.env`).
3. Inicialize o schema com `npm run db:init` e verifique com `npm run db:check`.
4. Execute [`docs/banco/rls.sql`](../docs/banco/rls.sql) no *SQL Editor* do Supabase e desative a Data API (PostgREST).
5. No Render, configure `NODE_ENV=production`, `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGIN` e `TRUST_PROXY=1`.
