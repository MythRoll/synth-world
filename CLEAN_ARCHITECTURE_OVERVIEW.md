# Clean Architecture Overview

## Structure
- `apps/web`: React + Vite frontend.
- `apps/api`: Node/Express API, MariaDB-ready.
- `packages/shared`: shared contracts/utilities placeholder for cross-app code.
- `docs`: architecture and migration docs.

## Frontend/Backend interaction
- Web calls API through `apiClient` and domain service modules in `apps/web/src/services`.
- Primary base URL: `VITE_API_BASE_URL`.
- Backend responds under `/api/*` and handles DB I/O through `mysql2` pool.

## Local run
1. Install dependencies from repo root: `npm install`
2. API: `npm run dev:api`
3. Web: `npm run dev`
4. Build web: `npm run build`

## Environment
### Web
- `VITE_API_BASE_URL`

### API
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
