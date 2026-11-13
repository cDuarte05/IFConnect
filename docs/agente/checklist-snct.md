# Checklist Operacional — Apresentação na SNCT (Assistente RAG)

Guia rápido de preparação, verificação antes da apresentação e plano de contingência para o assistente de IA do IFConnect.

---

## D-7 (uma semana antes)

- [ ] **Conferir cotas e limites das chaves de API:**
  - Provedor de LLM configurado (`AGENTE_IA_PROVIDER` / `AGENTE_IA_API_KEY`, ex.: Groq ou Gemini).
  - Provedor de embedding configurado (`AGENTE_RAG_EMBEDDING_PROVIDER=gemini` / `AGENTE_RAG_EMBEDDING_API_KEY`).
- [ ] **Testar as chaves em outro dispositivo/rede** (fora da rede principal de desenvolvimento, para validar ausência de bloqueio de firewall/CORS e validar latência).
- [ ] **Auditar ausência de segredos no repositório:**
  - Confirmar que `.env` está ignorado no `.gitignore` e que nenhuma chave real foi versionada em `backend/.env.example`, `docs/`, `scripts/` ou `tests/`.

---

## D-3 (três dias antes)

- [ ] **Executar reindexação contra o banco da apresentação:**
  ```bash
  cd backend
  npm run agente:reindex
  ```
- [ ] **Conferir o resumo e a contagem de chunks:**
  - Verificar que `falhas` terminou vazio (`codigoDeSaida === 0`) e que os artigos `publicado` e projetos `ativa`/`financiada` geraram chunks em `agente_chunks` (e nenhum item `em_revisao`, `rascunho`, `recusado`, `em_analise` ou `encerrada`).
- [ ] *(Opcional / se houver calibragem com provedor real)* Rodar `npm run agente:eval` e registrar os resultados em [`spec-rag.md`](./spec-rag.md) (`AGENTE_RAG_MIN_SCORE`: *preencher após rodar `agente:eval`*).

---

## D-1 (véspera)

- [ ] **Executar o smoke test contra o ambiente final:**
  ```bash
  cd backend
  BASE_URL=https://sua-api-final npm run agente:smoke
  ```
  - Confirmar código de saída `0`, `GET /api/agente/status` retornando `{ habilitado: true }`, respostas `200`, `url` interna começando com `/` e latência abaixo de `15 s`.
- [ ] **Validar o frontend:** abrir a aplicação no navegador, confirmar que o botão flutuante do assistente aparece, envia perguntas, exibe citações com links internos (`/publicacoes/:id` e `/vitrine/:id`) e trata erro amigavelmente.

---

## No dia da apresentação

- [ ] **Conferir variáveis do `.env` no servidor ativo:**
  - `AGENTE_IA_ENABLED=true`
  - `AGENTE_RAG_ENABLED=true`
  - `AGENTE_IA_PROVIDER`, `AGENTE_IA_API_KEY`, `AGENTE_IA_MODEL`
  - `AGENTE_RAG_EMBEDDING_PROVIDER=gemini`, `AGENTE_RAG_EMBEDDING_MODEL=gemini-embedding-001`, `AGENTE_RAG_EMBEDDING_DIM=768`, `AGENTE_RAG_EMBEDDING_API_KEY`
  - `AGENTE_IA_RATE_LIMIT` e `TRUST_PROXY` (ver alerta abaixo)

> ⚠️ **Alerta de rede compartilhada (Wi-Fi do evento) e Rate Limit:**
> Se muitas pessoas testarem o assistente simultaneamente no Wi-Fi do evento, todas sairão pelo mesmo IP público e compartilharão o limite de `AGENTE_IA_RATE_LIMIT` (padrão `10` req/min por IP).
> - **Ajuste `AGENTE_IA_RATE_LIMIT`** conforme o público esperado no estande (ex.: `60` ou mais) antes de iniciar a apresentação.
> - Se o backend estiver atrás de **proxy reverso** (Nginx, Render, ALB, Cloudflare etc.), defina **`TRUST_PROXY=1`** (ou o número de proxies) no `.env` para que o `express-rate-limit` leia o IP real em `X-Forwarded-For` em vez de bloquear todos os visitantes no IP do proxy.

---

## MODO DE EMERGÊNCIA (executar nesta ordem)

Caso ocorra instabilidade na API externa, esgotamento de cota ou comportamento indesejado durante a apresentação:

1. **Passo 1 — Voltar à busca legada sem RAG:**
   - Alterar no `.env` do servidor:
     ```env
     AGENTE_RAG_ENABLED=false
     ```
   - Reiniciar o backend. O sistema passa imediatamente ao fluxo legado (RF-14), mantendo o assistente funcional sem depender de embeddings nem de `agente_chunks`.

2. **Passo 2 — Desligar o LLM (modo `busca` puro) ou ocultar o assistente:**
   - **Para manter o widget útil sem chamar LLM externo:** remover ou limpar `AGENTE_IA_API_KEY=` e reiniciar. Toda pergunta responderá em `modo: "busca"` listando publicações e projetos encontrados no banco.
   - **Para ocultar completamente o assistente da interface:** definir
     ```env
     AGENTE_IA_ENABLED=false
     ```
     e reiniciar. `GET /api/agente/status` passará a responder `{ habilitado: false }` (ocultando o componente no frontend) e `POST /api/agente/consulta` responderá `503` sem afetar nenhuma outra funcionalidade do portal.

---

## O que dizer ao público se o provedor de IA ficar indisponível

- Caso o provedor externo (LLM ou embedding) fique lento ou indisponível durante uma demonstração ao vivo:
  > *"O portal continua funcionando normalmente: quando o modelo externo de linguagem fica indisponível, o assistente degrada automaticamente para o modo de busca direta no acervo publicado e exibe a lista de publicações e projetos relacionados com seus links internos."*
- Explicar que essa degradação segura é intencional (RF-05 / RF-13): o portal nunca trava nem inventa respostas fora do conteúdo moderado.

