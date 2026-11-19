# Frontend — IFConnect

Interface em React (Vite), com identidade visual de "caderno de campo": papel, selos de categoria, comentários em tempo real (SSE), Central de Ajuda e Assistente de IA.

## Rodando localmente

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 (a API precisa estar rodando em :4000)
```

> **Windows PowerShell:** se `npm` estiver bloqueado por política de execução, use `npm.cmd` ou Git Bash.

## Estrutura

- `src/pages/` — `Home`, `ArticleDetail`, `SubmitArticle`, `EditArticle`, `Crowdfunding` (vitrine), `CampaignDetail`, `SubmitCampaign`, `EditCampaign`, `Profile`, `Moderation` (restrita a `professor_moderador`), `Login`, `Register`, `Help` (`/ajuda`) e `About` (`/sobre`).
- `src/components/` — `Navbar`, `Footer`, `AssistenteIA`, `CommentsSection`, `ArticleCard`, `CampaignCard` e `FundingBar`.
- `src/config/projeto.js` e `src/content/faq.js` — metadados do projeto e perguntas frequentes estáticas.
- `src/context/AuthContext.jsx` — sessão do usuário (token JWT em `localStorage`).
- `src/api/client.js` — cliente Axios apontando para `/api` (proxy local em `vite.config.js`).

## Build e hospedagem (Render)

O build estático é gerado com `npm run build` (pasta `dist/`) e pode ser pré-visualizado localmente com `npm run preview`. A demonstração publicada está hospedada no Render.
