# CLAUDE.md

## Project Overview

B2B CRM Dashboard — a React single-page application for tracking sales leads, visualizing pipeline analytics, and crafting AI-powered emails using the Anthropic API.

## Tech Stack

- **Frontend:** React 19, React Router 7 (HashRouter), Tailwind CSS 4, Recharts, Lucide React
- **Backend:** Express 5 server (`server.js`) for AI email generation via Anthropic SDK
- **Build:** Vite 7 with `@vitejs/plugin-react` and `@tailwindcss/vite`
- **Linting:** ESLint 9 with react-hooks and react-refresh plugins
- **Deployment:** GitHub Pages (static build via `.github/workflows/`)

## Commands

- `npm run dev` — Start Vite dev server (frontend)
- `npm run server` — Start Express backend for AI email endpoint (port 3001)
- `npm run build` — Production build to `dist/`
- `npm run lint` — Run ESLint across the project
- `npm run preview` — Preview the production build locally

## Project Structure

```
src/
  App.jsx            — Root component with routing
  main.jsx           — Entry point
  index.css          — Global styles (Tailwind)
  components/        — Reusable UI components (Layout, StatCard, StageBadge, StageBar)
  pages/             — Route pages (Dashboard, LeadList, LeadForm, AIEmail)
  hooks/             — Custom hooks (useLeads)
  utils/             — Helpers and constants (storage, constants)
server.js            — Express API server for AI email generation
```

## Code Conventions

- JavaScript (no TypeScript) with JSX for React components
- ES modules (`"type": "module"` in package.json)
- Functional components with hooks only — no class components
- `export default function ComponentName()` pattern for components
- Tailwind CSS utility classes for styling (no CSS modules or styled-components)
- Data is stored in localStorage via `src/utils/storage.js`
- ESLint rule: unused vars are errors, except those starting with uppercase or `_`

## Important Notes

- Vite `base` is set to `/Learncode/` for GitHub Pages deployment
- The AI email endpoint (`POST /api/craft-email`) uses SSE streaming and requires `ANTHROPIC_API_KEY` env var
- Frontend uses HashRouter (not BrowserRouter) for GitHub Pages compatibility
