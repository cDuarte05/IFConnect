<div align="center">

# 🔬 IFConnect

**Portal aberto de divulgação científica, educacional, cultural e comunitária**

Notícias, artigos, textos e poemas de estudantes e da comunidade, mais uma **vitrine** para projetos que buscam apoio, doações ou parcerias.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)
![Sequelize](https://img.shields.io/badge/Sequelize-SQLite%20%7C%20PostgreSQL-52B0E7?logo=sequelize&logoColor=white)
![Jest](https://img.shields.io/badge/tests-Jest%20%2B%20Supertest-C21325?logo=jest&logoColor=white)
![Status](https://img.shields.io/badge/projeto-acad%C3%AAmico-E8AA42)

</div>

---

## 📖 Sobre

O IFConnect aproxima estudantes, jovens jornalistas, professores e a comunidade, oferecendo um espaço para publicar conteúdos e divulgar projetos. Todo conteúdo passa por **moderação leve** antes de ficar público.

Projeto desenvolvido na disciplina *Práticas em Sociedade e Informática III*, no **IFSP – Campus Hortolândia** (Análise e Desenvolvimento de Sistemas).

## ✨ Funcionalidades

| Área | O que oferece |
|---|---|
| 🔐 **Autenticação** | Cadastro, login com JWT, perfil editável e autorização por tipo de usuário |
| 📰 **Publicações** | Notícias escolares/globais, artigos científicos, textos, poemas e projetos, com edição pelo autor |
| 🧪 **Vitrine científica** | Projetos com meta financeira, prazo, barra de progresso e apoios (doações simbólicas) |
| 🗂️ **Organização e busca** | Categorias, temas (científico, educacional, cultural, comunitário) e palavras-chave |
| 🛡️ **Moderação** | Fila de pendentes para aprovar ou recusar publicações e projetos, e criação de categorias |
| 📱 **Interface** | Layout responsivo no estilo "caderno de campo", com foco visível e rótulos em formulários |

### Fluxos principais

```
Cadastro/Login ─▶ acesso ao sistema
Usuário ─▶ cria publicação ─▶ em revisão ─▶ moderação ─▶ publicada ─▶ consulta
Usuário ─▶ cadastra projeto ─▶ em análise ─▶ moderação ─▶ ativa ─▶ apoios ─▶ financiada
Público ─▶ busca e consulta de conteúdos
```

### Perfis de usuário

`estudante` · `jornalista_jovem` · `membro_comunidade` (autocadastro) e `professor_moderador` (**não** pode ser autoatribuído; criado via seed ou administrativamente).

## 🧱 Arquitetura

```
IFConnect/
├── backend/     API REST: Node.js + Express + Sequelize
│   ├── src/     config, controllers, middleware, models, routes, utils
│   └── tests/   Jest + Supertest (SQLite em memória)
└── frontend/    Interface: React + Vite
    └── src/     api, components, context, pages, styles
```

**Entidades:** Usuário · Publicação (Article) · Projeto (Campaign) · Categoria · Doação.

## 🚀 Como rodar localmente

**Pré-requisitos:** Node.js 18+ e npm.

```bash
# Terminal 1 — API
cd backend
npm install
cp .env.example .env     # defina um JWT_SECRET forte
npm run seed             # cria o banco SQLite com dados de exemplo
npm run dev              # http://localhost:4000

# Terminal 2 — Interface
cd frontend
npm install
npm run dev              # http://localhost:5173
```

O Vite encaminha `/api` para `localhost:4000`.

### 👤 Contas de exemplo (somente desenvolvimento)

| Perfil | E-mail | Senha |
|---|---|---|
| Professora moderadora | `marina.alves@escola.edu.br` | `senha123` |
| Estudante | `lucas.ferreira@escola.edu.br` | `senha123` |

### ⚙️ Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `JWT_SECRET` | Segredo de assinatura dos tokens (**obrigatório**) |
| `JWT_EXPIRES_IN` | Validade do token (padrão `7d`) |
| `PORT` | Porta da API (padrão `4000`) |
| `CORS_ORIGIN` | Domínios permitidos, separados por vírgula (defina em produção) |
| `DB_DIALECT=postgres` + `DB_HOST/PORT/NAME/USER/PASSWORD` | Usa PostgreSQL em vez de SQLite |

## 🔌 Principais rotas da API

| Recurso | Rotas |
|---|---|
| Auth | `POST /api/auth/registrar` · `POST /api/auth/login` · `GET/PATCH /api/auth/perfil` |
| Categorias | `GET /api/categorias` · `POST /api/categorias` *(professor)* |
| Publicações | `GET/POST /api/artigos` · `GET/PUT /api/artigos/:id` · `PATCH /api/artigos/:id/moderar` *(professor)* |
| Projetos | `GET/POST /api/campanhas` · `GET/PUT /api/campanhas/:id` · `PATCH /api/campanhas/:id/moderar` *(professor)* |
| Apoios | `POST /api/doacoes/:campaignId` |
| Saúde | `GET /api/saude` |

Detalhes completos em [`backend/README.md`](backend/README.md).

## 🧪 Testes

```bash
cd backend
npm test
```

Os testes cobrem registro (incluindo o bloqueio de autoatribuição de moderador), login, autorização por perfil, publicações, projetos, categorias, moderação e doações, usando SQLite em memória.

## 🔒 Segurança

- Senhas com hash **bcrypt**; autenticação via **JWT**
- Autorização por perfil (`permitir('professor_moderador')`)
- `helmet`, `cors` configurável, **rate limiting** e validação de entrada com `express-validator`
- Conteúdo em análise visível apenas ao autor e a moderadores

## 🗺️ Evolução prevista

Itens citados na documentação como possibilidades futuras, **não** obrigatórios na versão atual:

- ☁️ **Nuvem (AWS):** S3, CloudFront, Cognito, entre outros
- 🔁 **CI/CD e DevSecOps:** GitHub Actions com testes, SAST, SCA, DAST e SBOM
- 🤖 **Assistente de IA** (conversacional, de busca e orientação), como extensão avaliada na análise de viabilidade

## 📚 Documentação

A referência oficial é composta pelo **Documento do Projeto**, pela **Modelagem com IA**, pela **Análise de Viabilidade** e pelo documento de **CI/CD e SecDevOps**, entregues à disciplina.

## 👥 Equipe

**Luis M. S. Solera** · **Henrique C. Duarte** · **Vitor G. Quiroga**

Orientação: Prof. Carlos Eduardo Pagani, IFSP – Campus Hortolândia.

## 📄 Licença

Projeto acadêmico de código aberto.
