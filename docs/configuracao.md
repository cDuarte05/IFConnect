# Configuração e Variáveis de Ambiente — IFConnect

Referência completa das variáveis declaradas em [`backend/.env.example`](../backend/.env.example) e lidas por [`backend/src/server.js`](../backend/src/server.js), [`backend/src/app.js`](../backend/src/app.js), [`backend/src/config/database.js`](../backend/src/config/database.js), [`backend/src/services/agente/config.js`](../backend/src/services/agente/config.js) e [`backend/src/utils/seed.js`](../backend/src/utils/seed.js).

> **Nota importante sobre `AGENTE_IA_ENABLED`:** quando a variável é omitida do ambiente, o padrão **no código** (`config.js`) é desligado (`false`, pois verifica `=== 'true'`). No `.env.example`, ela vem pré-preenchida como `true` para facilitar o uso local.

## Aplicação e segurança

| Nome | Obrigatória? | Padrão no código | Valor no `.env.example` | Descrição | É segredo? |
|---|---|---|---|---|---|
| `NODE_ENV` | Não | `undefined` (`test` ativa SQLite `:memory:`) | `development` | Ambiente de execução (`development`, `test`, `production`) | Não |
| `API_PORT` | Não | `4000` (junto com `PORT`) | *(não declarada)* | Porta HTTP da API (tem precedência sobre `PORT`) | Não |
| `PORT` | Não | `4000` | `4000` | Porta HTTP da API (injetada por plataformas como Render; no frontend, `vite.config.js` usa fallback `5173`) | Não |
| `JWT_SECRET` | **Sim** | `undefined` | `troque-por-um-segredo-forte-em-producao` | Chave secreta de assinatura dos tokens JWT | **Sim** |
| `JWT_EXPIRES_IN` | Não | `'7d'` | `7d` | Tempo de expiração dos tokens JWT | Não |
| `CORS_ORIGIN` | Recomendada em prod | `''` (CORS aberto se vazio) | *(comentada: `http://localhost:5173`)* | Origens permitidas separadas por vírgula | Não |
| `TRUST_PROXY` | Atrás de proxy | `undefined` (desativado) | *(comentada)* | Número de proxies reversos (ex.: `1`) para resolução correta de `req.ip` | Não |

## Banco de dados

| Nome | Obrigatória? | Padrão no código | Valor no `.env.example` | Descrição | É segredo? |
|---|---|---|---|---|---|
| `DATABASE_URL` | Produção | `undefined` | *(comentada)* | String de conexão PostgreSQL (ex.: Supabase Session pooler, porta 5432); ignorada em `NODE_ENV=test` | **Sim** |
| `DB_DIALECT` | Não | `'sqlite'` | *(comentada: `postgres`)* | Dialeto explícito quando não se utiliza `DATABASE_URL` | Não |
| `DB_HOST` | Se `DB_DIALECT=postgres` | `'localhost'` | *(comentada)* | Host do servidor PostgreSQL | Não |
| `DB_PORT` | Se `DB_DIALECT=postgres` | `5432` | *(comentada: `5432`)* | Porta do servidor PostgreSQL | Não |
| `DB_NAME` | Se `DB_DIALECT=postgres` | `undefined` | *(comentada)* | Nome do banco PostgreSQL | Não |
| `DB_USER` | Se `DB_DIALECT=postgres` | `undefined` | *(comentada)* | Usuário do banco PostgreSQL | Não |
| `DB_PASSWORD` | Se `DB_DIALECT=postgres` | `undefined` | *(comentada)* | Senha do banco PostgreSQL | **Sim** |
| `DB_SSL` | Não | SSL ativo em Postgres | *(não declarada)* | Defina `'false'` para desativar SSL no PostgreSQL | Não |
| `DB_SSL_CA_PATH` | Não | `undefined` | *(comentada)* | Caminho de certificado CA para validação SSL (`rejectUnauthorized: true`) | Não |
| `SQLITE_STORAGE` | Não | `'./portal.sqlite'` | *(não declarada)* | Caminho do arquivo SQLite em desenvolvimento | Não |
| `PERMITIR_SEED_REMOTO` | Não | `undefined` | *(comentada)* | Trava de segurança exigida (`sim`) junto com `--confirmar-remoto` para rodar `seed` em host remoto | Não |

## Assistente de IA e RAG

| Nome | Obrigatória? | Padrão no código | Valor no `.env.example` | Descrição | É segredo? |
|---|---|---|---|---|---|
| `AGENTE_IA_ENABLED` | Não | `false` (`=== 'true'`) | `true` | Liga/desliga o Assistente de IA (`503` na API quando desligado) | Não |
| `AGENTE_IA_PROVIDER` | Não | `undefined` | `groq` | Provedor LLM (`groq`, `gemini`, `anthropic`) | Não |
| `AGENTE_IA_API_KEY` | Não | `undefined` | *(vazia)* | Chave da API do provedor LLM (vazia ativa fallback `busca`) | **Sim** |
| `AGENTE_IA_MODEL` | Não | `'openai/gpt-oss-120b'` (Groq) / `'gemini-3.1-flash-lite'` / `'claude-haiku-5-5'` | `openai/gpt-oss-120b` | Modelo de chat utilizado pelo provedor LLM | Não |
| `AGENTE_IA_TIMEOUT_MS` | Não | `8000` | `8000` | Timeout das chamadas ao LLM em milissegundos | Não |
| `AGENTE_IA_RATE_LIMIT` | Não | `10` | `10` | Limite de perguntas por minuto por IP | Não |
| `AGENTE_RAG_ENABLED` | Não | `false` (`=== 'true'`) | `false` | Ativa o pipeline RAG híbrido (`false` mantém fluxo legado) | Não |
| `AGENTE_RAG_EMBEDDING_PROVIDER` | Não | `'gemini'` | `gemini` | Provedor de embeddings (`gemini` ou `mock`) | Não |
| `AGENTE_RAG_EMBEDDING_MODEL` | Não | `'gemini-embedding-001'` | `gemini-embedding-001` | Modelo de embedding | Não |
| `AGENTE_RAG_EMBEDDING_DIM` | Não | `768` | `768` | Dimensão esperada dos vetores | Não |
| `AGENTE_RAG_EMBEDDING_API_KEY` | Não | `undefined` (herda `AGENTE_IA_API_KEY` se `AGENTE_IA_PROVIDER=gemini`) | *(vazia)* | Chave da API de embeddings | **Sim** |
| `AGENTE_RAG_TOP_K` | Não | `4` | `4` | Quantidade máxima de trechos enviados no contexto ao LLM | Não |
| `AGENTE_RAG_MIN_SCORE` | Não | `null` | *(comentada)* | Limiar mínimo de similaridade vetorial | Não |
| `AGENTE_RAG_RECONCILIAR_INTERVALO_MIN` | Não | `360` | `360` | Intervalo de reconciliação do índice em minutos (`0` = apenas na inicialização) | Não |
