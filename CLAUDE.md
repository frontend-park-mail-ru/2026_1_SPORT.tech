# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server (http://localhost:8080 by default)
npm run dev

# Production build → dist/
npm run build

# TypeScript type checking (no emit)
npm run type-check

# Lint
npm run lint

# Lint with auto-fix
npm run lint:fix
```

There is no test suite in this project.

## Architecture

**Stack**: Vanilla TypeScript + Handlebars templates + Webpack 5 + Babel. No UI framework (no React/Vue/Svelte).

### Routing (`src/main.ts`)

A custom client-side router is implemented directly in `main.ts`. It:
- Uses `history.pushState` for navigation via `navigateTo(path)`
- Guards all routes: unauthenticated users are redirected to `/auth`
- Lazy-loads each page via dynamic `import()` on navigation
- Exposes the router as `window.router` for use in components

Routes: `/`, `/auth`, `/profile`, `/profile/:id`, `/notifications`, `/payment/return`, `/payment/cancel`

### Component Model (Atomic Design)

Components live under `src/components/` in three tiers: `atoms/`, `molecules/`, `organisms/`. Pages are in `src/pages/`. Each component is a folder with three files:
- `Component.hbs` — Handlebars template (loaded as raw string by webpack)
- `Component.ts` — TypeScript logic, exports an async `render*()` function
- `Component.css` — scoped styles (injected via style-loader)

**Component rendering pattern**: Each component exports an async function (e.g., `renderButton(container, config)`). It renders into the provided `container` DOM element imperatively and returns either the root element or a control API object.

### Handlebars Template System (`src/templates.ts`)

All `.hbs` files are imported and compiled at startup in `src/templates.ts`, then registered on the global `Handlebars.templates` object. Components access templates via:

```ts
const template = (window as any).Handlebars.templates['Component.hbs'];
const html = template(data);
```

When adding a new component, register its template in `src/templates.ts` (both the import and the `Handlebars.compile(...)` entry).

### API Client (`src/utils/api.ts`)

`ApiClient` is a class instantiated once in `main.ts` and passed down through render functions as the `api` parameter. It:
- Proxies all requests through `/api` (configured in webpack dev server; see `API_BASE_URL` in `src/config/constants.ts`)
- Automatically fetches and attaches CSRF tokens (`X-CSRF-Token` header) for all mutating requests (POST/PUT/PATCH/DELETE)
- Uses `credentials: 'include'` for session cookies on every request
- FormData uploads (avatar, post media) bypass the JSON Content-Type header automatically

### TypeScript Path Alias

`@` maps to `src/` (configured in `webpack.config.cjs` and `tsconfig.json`).

### ESLint Rules

- Single quotes, 2-space indent, semicolons required
- `no-console` warns except for `warn`/`error`
- `@typescript-eslint/no-explicit-any` is disabled (use of `any` is allowed)
- Unused vars are errors (prefix with `_` to suppress)
