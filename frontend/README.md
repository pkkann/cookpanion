# Cookpanion — Frontend

Single-page app for the Cookpanion project. React + Vite + TypeScript with MUI.

## Stack

- Vite + React 19 + TypeScript
- MUI (`@mui/material`, `@mui/icons-material`, `@emotion/*`)
- `react-router-dom` for routing
- `@tanstack/react-query` for data fetching & caching
- `axios` HTTP client with a JWT `Authorization` interceptor + 401 redirect

## Configuration

- `VITE_API_URL` — base URL of the backend API. Falls back to `http://localhost:8000/api`.

Copy `.env.example` to `.env` to override locally.

## Scripts

```bash
npm install        # install dependencies
npm run dev        # dev server on 0.0.0.0:5173
npm run build      # type-check (tsc -b) + production build to dist/
npm run preview    # preview the production build
npm run lint       # oxlint
```

## Structure

```
src/
  api/         axios client, typed endpoint fns, react-query hooks, TS types
  auth/        AuthContext + ProtectedRoute
  components/  Layout (AppBar + drawer), dialogs, shared UI
  pages/       Login, Register, Dashboard, Ingredients, Kitchen, Recipes,
               RecipeDetail, AISuggestions
  theme/       MUI theme
```

The API shapes in `src/api/types.ts` mirror `../API_CONTRACT.md`.
