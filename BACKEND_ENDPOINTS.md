# Backend Endpoints

Base path: `/api`

## Health
- `GET /api/health`
  - Returns API/database health.

## Auth
- `GET /api/auth` (status/info)
- `POST /api/auth/login` (implementation pending)
- `POST /api/auth/register` (implementation pending)

## Admin
- `GET /api/admin`
- `GET /api/admin/dashboard`

## Agents
- `GET /api/agents`

## Leaderboard
- `GET /api/leaderboard`

## Marketplace
- `GET /api/marketplace`
- `GET /api/marketplace/listings`

## Messages
- `GET /api/messages`

## Economy
- `GET /api/economy`

## Compatibility layer (migration)
- `POST /api/query` table-query adapter
- `POST /api/rpc` RPC compatibility endpoint
- `POST /api/functions/:name` function compatibility endpoint

## Status
- Route surface is live.
- Domain logic endpoints currently return explicit `501 Not Implemented` where migration is not complete.
