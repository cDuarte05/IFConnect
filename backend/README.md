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

Contas `professor_moderador` não são criadas por autocadastro (ver seção de
segurança abaixo) — use `npm run seed` ou crie diretamente via model/console
administrativo.

## Testes

```bash
npm install
npm test
```

Os testes usam Jest + Supertest contra um banco SQLite em memória (isolado do
`portal.sqlite` de desenvolvimento), cobrindo os pontos que a documentação do
projeto destaca como prioritários: registro (incluindo o bloqueio de
autoatribuição de `professor_moderador`), login, autorização por perfil,
publicação/edição/moderação de conteúdo, projetos e doações.

> Neste ambiente de geração de código não havia acesso à internet para
> instalar as dependências (`jest`/`supertest`), então os testes foram
> escritos e revisados manualmente linha a linha contra a lógica dos
> controllers, mas **não foram executados**. Rode `npm test` localmente
> para confirmar.

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
