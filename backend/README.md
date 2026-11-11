# Backend — IFConnect

API REST em Node.js/Express que sustenta o portal: publicações (notícias, textos,
poemas, projetos), campanhas da vitrine de projetos e apoios/doações.

## Rodando localmente

```bash
cd backend
npm install
cp .env.example .env
npm run seed   # cria banco SQLite local com dados de exemplo
npm run dev    # inicia em http://localhost:4000
```

## Principais rotas

| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| POST | /api/auth/registrar | Cria conta (`estudante`, `jornalista_jovem` ou `membro_comunidade`) | — |
| POST | /api/auth/login | Login, retorna JWT | — |
| GET | /api/auth/perfil | Dados do próprio perfil | sim |
| PATCH | /api/auth/perfil | Atualiza nome/instituição/bio do próprio perfil | sim |
| GET | /api/categorias | Lista categorias (classificação por assunto) | — |
| POST | /api/categorias | Cria categoria | professor |
| GET | /api/artigos | Lista publicações públicas (filtros `?tipo=`, `?categoryId=`, `?tema=`, `?busca=`) | — |
| GET | /api/artigos/:id | Detalhe de uma publicação | — |
| GET | /api/artigos/minhas/publicacoes | Publicações do usuário logado (qualquer status) | sim |
| GET | /api/artigos/moderacao/pendentes | Fila de publicações aguardando revisão | professor |
| POST | /api/artigos | Cria publicação (entra em revisão, exceto para professores) | sim |
| PUT | /api/artigos/:id | Edita publicação própria (só enquanto não aprovada, exceto professores) | sim |
| PATCH | /api/artigos/:id/moderar | Aprova/recusa publicação | professor |
| GET | /api/campanhas | Lista campanhas ativas na vitrine (filtros `?categoryId=`, `?tema=`, `?busca=`) | — |
| GET | /api/campanhas/:id | Detalhe de um projeto | — |
| GET | /api/campanhas/minhas/campanhas | Projetos do usuário logado (qualquer status) | sim |
| GET | /api/campanhas/moderacao/pendentes | Fila de projetos aguardando análise | professor |
| POST | /api/campanhas | Cria projeto (entra em análise) | sim |
| PUT | /api/campanhas/:id | Edita projeto próprio (só enquanto em análise) | sim |
| PATCH | /api/campanhas/:id/moderar | Aprova (`ativa`)/recusa (`encerrada`) projeto | professor |
| POST | /api/doacoes/:campaignId | Registra apoio a um projeto | sim |
| GET | /api/agente/status | Informa `{ habilitado: boolean }` do assistente de IA | — |
| POST | /api/agente/consulta | Pergunta em linguagem natural ao assistente (RAG ou busca) | — |

Contas `professor_moderador` não são criadas por autocadastro (ver seção de
segurança abaixo) — use `npm run seed` ou crie diretamente via model/console
administrativo.

## Assistente de IA (RAG)

O assistente responde dúvidas em português do Brasil sobre conteúdos **públicos**
do portal (publicações `publicado` e campanhas `ativa`/`financiada`), além de
orientar sobre navegação e submissão. Nunca acessa rascunhos, itens em revisão/análise,
recusados, encerrados ou dados pessoais de usuários.

- Especificação e decisões: [`docs/agente/spec-rag.md`](../docs/agente/spec-rag.md),
  [`ADR-0001`](../docs/agente/adr-0001-rag-vetores-em-tabela.md) e
  [`ADR-0002`](../docs/agente/adr-0002-provedores-e-configuracao.md).
- Checklist de apresentação (SNCT): [`docs/agente/checklist-snct.md`](../docs/agente/checklist-snct.md).

### Variáveis de ambiente (conforme `.env.example`)

| Variável | Padrão no `.env.example` | Finalidade |
|---|---|---|
| `AGENTE_IA_ENABLED` | `true` | Liga/desliga o assistente (`false` → 503 e oculto no frontend) |
| `AGENTE_IA_PROVIDER` | `groq` | Provedor de LLM (`anthropic`, `gemini`, `groq`) |
| `AGENTE_IA_API_KEY` | *(vazio)* | Chave do LLM (vazia → degrada para modo `busca`) |
| `AGENTE_IA_MODEL` | `llama-3.3-70b-versatile` | Modelo de chat do LLM |
| `AGENTE_IA_TIMEOUT_MS` | `8000` | Timeout das chamadas ao LLM (ms) |
| `AGENTE_IA_RATE_LIMIT` | `10` | Limite de perguntas por minuto por IP |
| `TRUST_PROXY` | *(comentado)* | Número de proxies reversos à frente da API (ex.: `1`) para rate limit por IP |
| `AGENTE_RAG_ENABLED` | `false` | Liga o RAG híbrido (`false` → comportamento legado) |
| `AGENTE_RAG_EMBEDDING_PROVIDER` | `gemini` | Provedor de embeddings (`gemini` ou `mock`) |
| `AGENTE_RAG_EMBEDDING_MODEL` | `gemini-embedding-001` | Modelo de embedding |
| `AGENTE_RAG_EMBEDDING_DIM` | `768` | Dimensão do vetor de embedding |
| `AGENTE_RAG_EMBEDDING_API_KEY` | *(vazio)* | Chave do embedding (se `AGENTE_IA_PROVIDER=gemini` e vazia, herda `AGENTE_IA_API_KEY`) |
| `AGENTE_RAG_TOP_K` | `4` | Quantidade máxima de trechos enviados ao LLM |
| `AGENTE_RAG_MIN_SCORE` | *(comentado / preencher após rodar `agente:eval`)* | Limiar mínimo de relevância vetorial |

### Como indexar, avaliar e testar

- **Indexação em lote (idempotente):**
  ```bash
  npm run agente:reindex
  ```
  Indexa publicações `publicado` e campanhas `ativa`/`financiada`, pula itens sem mudança de hash, remove órfãos e reembeda tudo caso o modelo de embedding mude. Flags opcionais: `--dry-run`, `--force`, `--delay-ms=N`.

- **Avaliação offline de recuperação (não chama LLM):**
  ```bash
  npm run agente:eval
  npm run agente:eval -- --provider=mock
  ```
  Mede Recall@k, MRR, isolamento e varredura de limiar usando `tests/agente/eval/dataset.json`.
  - Recall@k / MRR / `AGENTE_RAG_MIN_SCORE` com provedor real: *preencher após rodar `agente:eval`*.

- **Smoke test HTTP contra servidor em execução (`BASE_URL`, padrão `http://localhost:4000`):**
  ```bash
  npm run agente:smoke
  ```
  Valida `GET /api/agente/status` e 6 perguntas reais em `POST /api/agente/consulta`, respeitando intervalo de `6,5 s` entre chamadas.

- **Teste de mutação (Stryker):**
  ```bash
  npm run agente:mutacao
  ```

### Como desligar / degradar

- **Voltar ao fluxo legado (sem RAG):** definir `AGENTE_RAG_ENABLED=false` no `.env` e reiniciar.
- **Desligar apenas o LLM (modo `busca` puro):** remover `AGENTE_IA_API_KEY` do `.env` e reiniciar.
- **Desligar todo o assistente:** definir `AGENTE_IA_ENABLED=false` e reiniciar (`GET /api/agente/status` devolve `{ habilitado: false }` e `POST /api/agente/consulta` responde `503`).

## Testes

```bash
npm install
npm test
```

Os testes usam Jest + Supertest contra um banco SQLite em memória (isolado do
`portal.sqlite` de desenvolvimento), com provedores externos de IA sempre mockados.
Cobrem registro (incluindo o bloqueio de autoatribuição de `professor_moderador`),
login, autorização por perfil, publicação/edição/moderação de conteúdo, projetos,
doações e todo o módulo do agente/RAG (recuperação, prompt, citações, indexação,
rotas, avaliação offline e ciclo E2E via HTTP). A matriz de cobertura dos critérios
está em [`docs/agente/cobertura-ca.md`](../docs/agente/cobertura-ca.md).

## Possível evolução para nuvem (AWS)

A documentação do projeto trata os recursos de nuvem como uma **possibilidade
prevista para uma fase mais avançada**, não como uma dependência da versão
atual. Caso a equipe decida seguir por esse caminho no futuro, o roteiro
seria aproximadamente este:

1. Trocar `DB_DIALECT=postgres` no `.env` e apontar para uma instância **Amazon RDS (PostgreSQL)**.
2. Subir a API em **AWS App Runner** ou **Elastic Beanstalk** (mais simples) ou em **ECS Fargate** (mais controle).
3. Trocar o campo `imagemCapaUrl` para apontar para objetos armazenados no **Amazon S3**, servidos via **CloudFront**.
4. Usar **AWS Secrets Manager** para `JWT_SECRET` e credenciais do banco em vez do `.env`.

Nenhum desses itens é necessário para rodar ou avaliar o projeto na fase atual.
