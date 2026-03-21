# Repo Migration Report

## Removed
- Removed vendor-bound infrastructure and references, including legacy vendor function folders and integration clients.
- Removed vendor-specific environment usage and switched to `VITE_API_BASE_URL` for web and MariaDB variables for API.

## Moved
- Frontend moved under `apps/web`.
- New backend API service added under `apps/api`.
- Shared/package/docs monorepo layout scaffolded (`packages/shared`, `docs`).

## Working now
- Frontend compiles against a custom API client (`apps/web/src/services/apiClient.ts`) instead of vendor SDK.
- Backend boots with Express + MariaDB connection pool and exposes required `/api/*` recovery routes.
- Route wiring includes leaderboard path and admin guard now fails explicitly with honest messaging.

## Still pending implementation
- Business-specific RPC/function parity with former backend features is intentionally returning `501 Not Implemented` until MariaDB-backed logic is completed.
- Auth/login/register and domain endpoints need table-specific SQL/services rollout.
