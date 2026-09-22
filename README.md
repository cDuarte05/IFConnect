# IFConnect — Portal de Divulgação Científica Estudantil e Comunitária

Projeto acadêmico: portal aberto e de código aberto para divulgação
científica, educacional e comunitária, com espaço específico ("vitrine")
para projetos de estudantes que buscam apoio, doações ou parcerias.

## Estrutura do repositório

```
backend/     API REST em Node.js + Express + Sequelize (SQLite local / PostgreSQL em produção)
frontend/    Interface em React + Vite
```

## Rodando o projeto completo localmente

```bash
# Terminal 1 — API
cd backend
npm install
cp .env.example .env
npm run seed
npm run dev      # http://localhost:4000

# Terminal 2 — Interface
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Contas de exemplo criadas pelo `npm run seed`:
- Professora moderadora: `marina.alves@escola.edu.br` / `senha123`
- Estudante: `lucas.ferreira@escola.edu.br` / `senha123`

## Documentação do projeto

A documentação oficial de referência é o **Documento do Projeto** e o
documento de **Modelagem/Metodologia com IA** entregues à disciplina. Eles
descrevem: identificação e objetivos do IFConnect, arquitetura planejada
(React, Node.js/Express, banco SQL), e os recursos de nuvem AWS como uma
**possibilidade prevista para uma fase futura mais avançada** do projeto —
não como uma decisão de infraestrutura já tomada.
