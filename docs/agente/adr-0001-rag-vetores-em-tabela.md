# ADR-0001: Armazenamento de Vetores em Tabela de Apoio e Busca em Memória

- **Status:** Aprovada
- **Data:** 2026-11-11
- **Relacionado:** [`spec-rag.md`](./spec-rag.md) (D3, D4, D6, RN-01, RN-02, RN-08, RN-09, RF-10)

---

## Contexto

O IFConnect precisa responder perguntas em linguagem natural sobre conteúdos públicos do portal (publicações `publicado` e campanhas `ativa`/`financiada`) por meio de busca semântica combinada com busca lexical (RAG híbrido). Na fase atual do projeto:

- O ambiente de desenvolvimento e demonstração opera com **SQLite local** (e previsão futura de migração para PostgreSQL em nuvem), sem banco vetorial gerenciado disponível.
- O corpus é **pequeno** (escala escolar/acadêmica, centenas a poucos milhares de chunks).
- Existe requisito explícito de que o portal inteiro funcione normalmente **sem chave de IA configurada** (RN-08), degradando de forma transparente para busca sem LLM.
- O isolamento de conteúdo não publicado (RN-01/RN-02) é crítico e exige garantia determinística no momento da consulta (re-hidratação em banco com filtro de status antes do corte de relevância — RF-10).

---

## Decisão

1. Persistir os trechos e seus embeddings na tabela relacional de apoio `agente_chunks` (`AgentChunk`), **sem chave estrangeira obrigatória** para `articles` ou `campaigns`, contendo apenas referência lógica (`sourceType`, `sourceId`), `chunkIndex`, `texto`, `contentHash`, `embedding` (JSON serializado com vetor normalizado L2), `embeddingModel` e `dim`.
2. Isolar toda leitura vetorial atrás da interface `vectorStore` (`backend/src/services/agente/retrieval/vectorStore.js`, implementação inicial `criarVectorStoreSqlite`).
3. Na consulta (`vector.js`), carregar os chunks do índice em memória (invalidado por assinatura de contagem/timestamp) e calcular a similaridade de cosseno diretamente em Node.js apenas entre vetores compatíveis (`embeddingModel` e `dim` iguais — RN-09).
4. Nunca confiar em metadados cacheados no chunk: título, status, categoria e valores financeiros (`metaFinanceira`, `valorArrecadado`) são sempre re-hidratados diretamente das tabelas `articles` e `campaigns` no momento da consulta (`hybrid.js`).

---

## Alternativas Rejeitadas

1. **Usar `pgvector` desde o início:** rejeitada porque não há PostgreSQL em nuvem provisionado no ambiente atual e nem mesmo o driver `pg` consta no `package.json`. Adotar `pgvector` agora quebraria o fluxo local baseado em SQLite.
2. **Contratar banco vetorial externo (Pinecone, Qdrant, Chroma etc.):** rejeitada por introduzir nova dependência operacional, custo/cadastro em terceiro, ponto extra de falha e necessidade de sincronização distribuída de status de moderação.
3. **Usar serviço gerenciado de RAG/Assistants do provedor de LLM:** rejeitada porque tira da aplicação o controle determinístico do filtro de status (`publicado`, `ativa`, `financiada`), dificulta impedir vazamento de rascunhos/recusados e gera acoplamento forte (*vendor lock-in*) a um único fornecedor.

---

## Consequências

- **Positivas:**
  - Zero dependências de infraestrutura externa além do banco já usado pela API (SQLite/PostgreSQL via Sequelize).
  - Filtro de privacidade/status garantido em duas camadas (indexação e re-hidratação transacional no banco).
  - Substituição futura por `pgvector` encapsulada em uma única interface (`vectorStore`), sem alterar o recuperador híbrido, o orquestrador ou as rotas.
- **Negativas / Pontos de atenção:**
  - Custo de memória RAM no processo Node cresce linearmente com o número de chunks armazenados em índice em memória.
  - Trocar o modelo de embedding exige reindexação completa (`npm run agente:reindex`), pois vetores de modelos diferentes são incompatíveis (RN-09 / CA-16).

