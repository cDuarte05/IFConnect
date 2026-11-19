# API REST — IFConnect

Todas as rotas respondem sob o prefixo `/api` e retornam erros no formato `{ erro: true, mensagem }`.

## Saúde e ajuda

| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| `GET` | `/api/saude` | Status da API (`{ status: 'ok', servico: 'ifconnect-api' }`) | Pública |
| `GET` | `/api/ajuda` | Guia do portal com limites interpolados (`Cache-Control: public, max-age=300`) | Pública |

## Autenticação e perfil

| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| `POST` | `/api/auth/registrar` | Autocadastro (`estudante`, `jornalista_jovem`, `membro_comunidade`) | Pública |
| `POST` | `/api/auth/login` | Autenticação e emissão de JWT | Pública |
| `GET` | `/api/auth/perfil` | Dados do usuário autenticado | JWT |
| `PATCH` | `/api/auth/perfil` | Atualiza nome, instituição e bio | JWT |

## Categorias

| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| `GET` | `/api/categorias` | Lista categorias ordenadas por nome | Pública |
| `POST` | `/api/categorias` | Cria nova categoria | `professor_moderador` |

## Publicações (`/api/artigos`)

| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| `GET` | `/api/artigos` | Lista publicações com status `publicado` (filtros `tipo`, `categoryId`, `tema`, `busca`) | Pública |
| `GET` | `/api/artigos/:id` | Detalhe de publicação (restrito a autor ou `professor_moderador` quando não publicada; incrementa `visualizacoes` apenas quando `publicado`) | Opcional / Autor / Moderador |
| `GET` | `/api/artigos/minhas/publicacoes` | Lista publicações do próprio usuário | JWT |
| `GET` | `/api/artigos/moderacao/pendentes` | Fila de publicações `em_revisao` | `professor_moderador` |
| `POST` | `/api/artigos` | Cria publicação (`em_revisao`, ou `publicado` se `professor_moderador`) | JWT |
| `PUT` | `/api/artigos/:id` | Edita publicação própria (reenvia `recusado` para `em_revisao`; bloqueado após aprovação, exceto `professor_moderador`) | JWT (Autor) |
| `DELETE` | `/api/artigos/:id` | Exclui publicação própria | JWT (Autor) |
| `PATCH` | `/api/artigos/:id/moderar` | Aprova (`publicado`) ou recusa (`recusado`) | `professor_moderador` |
| `GET` | `/api/artigos/:id/comentarios` | Lista comentários da publicação (restrito a autor ou `professor_moderador` quando não publicada) | Opcional / Autor / Moderador |
| `GET` | `/api/artigos/:id/comentarios/stream` | Stream SSE de comentários da publicação (restrito a autor ou `professor_moderador` quando não publicada) | Opcional / Autor / Moderador |
| `POST` | `/api/artigos/:id/comentarios` | Publica comentário (exige publicação visível ao usuário) | JWT |

## Vitrine científica (`/api/campanhas`) e apoios (`/api/doacoes`)

| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| `GET` | `/api/campanhas` | Lista projetos `ativa` ou `financiada` (filtros `categoryId`, `tema`, `busca`, `status`) | Pública |
| `GET` | `/api/campanhas/:id` | Detalhe de projeto (restrito a autor ou `professor_moderador` quando não público) | Opcional / Autor / Moderador |
| `GET` | `/api/campanhas/minhas/campanhas` | Lista projetos do próprio usuário | JWT |
| `GET` | `/api/campanhas/moderacao/pendentes` | Fila de projetos `em_analise` | `professor_moderador` |
| `POST` | `/api/campanhas` | Cadastra projeto (`em_analise`) | JWT |
| `PUT` | `/api/campanhas/:id` | Edita projeto próprio enquanto `em_analise` | JWT (Autor) |
| `PATCH` | `/api/campanhas/:id/moderar` | Aprova (`ativa`) ou recusa (`encerrada`) | `professor_moderador` |
| `GET` | `/api/campanhas/:id/comentarios` | Lista comentários do projeto | Pública |
| `GET` | `/api/campanhas/:id/comentarios/stream` | Stream SSE de comentários do projeto | Pública |
| `POST` | `/api/campanhas/:id/comentarios` | Publica comentário no projeto | JWT |
| `POST` | `/api/doacoes/:campaignId` | Registra apoio em projeto `ativa` (muda para `financiada` ao atingir a meta) | JWT |

## Comentários (`/api/comentarios`)

| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| `PUT` | `/api/comentarios/:id` | Edita comentário próprio (até 15 minutos após a criação) | JWT (Autor) |
| `DELETE` | `/api/comentarios/:id` | Exclui comentário (autor do comentário, autor do post ou `professor_moderador`) | JWT |

## Assistente de IA (`/api/agente`)

| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| `GET` | `/api/agente/status` | Retorna `{ habilitado: boolean }` | Pública |
| `POST` | `/api/agente/consulta` | Consulta o Assistente de IA (pergunta de 2 a 500 caracteres; rate limit por IP) | Pública |
