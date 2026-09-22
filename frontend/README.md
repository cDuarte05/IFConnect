# Frontend — IFConnect

Interface em React (Vite), com identidade visual de "caderno de campo":
papel, selos de categoria e um termômetro de arrecadação para as campanhas.

## Rodando localmente

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 (a API precisa estar rodando em :4000)
```

## Estrutura

- `src/pages` — telas: Home (feed), detalhe de publicação, envio e edição de
  publicação, vitrine de projetos, envio e edição de projeto, detalhe de
  projeto, perfil (com "minhas publicações"/"minhas campanhas"), moderação
  (restrita a professor_moderador), login e cadastro.
- `src/components` — Navbar, Footer, cartões de publicação/campanha e a barra
  de arrecadação.
- `src/styles/tokens.css` — paleta de cores e tipografia do projeto.
- `src/context/AuthContext.jsx` — sessão do usuário (token JWT em localStorage).

## Possível publicação em nuvem (AWS)

Assim como no backend, a hospedagem em nuvem é tratada na documentação do
projeto como uma possibilidade futura, não como requisito da fase atual. Se
adotada, o build estático (`npm run build`, pasta `dist/`) poderia ser
publicado em um bucket **Amazon S3** com **Amazon CloudFront** na frente.
