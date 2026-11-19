# Documentação — IFConnect

Índice dos documentos técnicos do projeto:

## Arquitetura, API e configuração

- [`api.md`](api.md) — referência completa das rotas REST (`/api`) e níveis de acesso.
- [`configuracao.md`](configuracao.md) — todas as variáveis de ambiente, padrões no código e `.env.example`.
- [`modelo-de-dados.md`](modelo-de-dados.md) — diagrama ER e descrição das entidades (incluindo `Comment` e `agente_chunks`).

## Assistente de IA (RAG)

- [`agente/spec-rag.md`](agente/spec-rag.md) — especificação funcional, requisitos e garantias de segurança do RAG.
- [`agente/adr-0001-rag-vetores-em-tabela.md`](agente/adr-0001-rag-vetores-em-tabela.md) — decisão de armazenar vetores na tabela desacoplada `agente_chunks`.
- [`agente/adr-0002-provedores-e-configuracao.md`](agente/adr-0002-provedores-e-configuracao.md) — separação de provedores (LLM vs. embedding), variáveis e degradação.
- [`agente/cobertura-ca.md`](agente/cobertura-ca.md) — matriz de cobertura dos critérios de aceitação nos testes.
- [`agente/mutacao.md`](agente/mutacao.md) — relatório de testes de mutação (Stryker).
- [`agente/avaliacao.md`](agente/avaliacao.md) — modelo para registro da avaliação offline do RAG com provedor real.
- [`agente/checklist-snct.md`](agente/checklist-snct.md) — checklist operacional para apresentação.

## Banco de dados

- [`banco/rls.sql`](banco/rls.sql) — políticas de Row Level Security para PostgreSQL/Supabase.
