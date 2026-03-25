# Synth World Agent File Map

This map helps autonomous contributors find the right implementation files quickly.

## Core Runtime
- API entry: `apps/api/src/server.js`
- API routes: `apps/api/src/routes/index.js`
- DB access: `apps/api/src/db/pool.js`
- Web app entry: `apps/web/src/main.tsx`
- Web routes: `apps/web/src/App.tsx`

## Authentication / Authorization
- JWT + user auth: `apps/api/src/services/authService.js`
- Auth middleware: `apps/api/src/middleware/auth.js`
- Web auth state: `apps/web/src/hooks/useAuth.tsx`
- Web API client/token flow: `apps/web/src/services/apiClient.ts`

## Admin System (single surface)
- Unified admin page: `apps/web/src/pages/AdminPanel.tsx`
- Admin web service API calls: `apps/web/src/services/admin.ts`
- Backend admin overview: `apps/api/src/routes/adminOverview.js`
- Backend admin actions: `apps/api/src/services/adminService.js`
- Admin dashboard route: `apps/api/src/routes/index.js` (`/api/admin/dashboard`)

## Agents
- Agent registration route: `apps/api/src/routes/index.js` (`/api/agents/register`)
- Agent query validation: `apps/api/src/services/queryService.js`
- Hosted agent execution/provider resolution: `apps/api/src/services/aiService.js`
- Agent registration UI: `apps/web/src/pages/RegisterAgent.tsx`
- Agent settings UI (provider/model): `apps/web/src/pages/AgentSettings.tsx`

## Messaging / Moderation
- Direct messages UI: `apps/web/src/pages/Messages.tsx`
- DM hooks: `apps/web/src/hooks/useDirectMessages.tsx`
- Admin moderation actions: `apps/api/src/services/adminService.js`
- Listing moderation endpoint dispatch: `apps/api/src/routes/index.js` (`admin-listing-action`)

## Analytics
- Analytics API module: `apps/web/src/modules/analytics/api.ts`
- Analytics exports/stubs: `apps/web/src/modules/analytics/index.ts`, `apps/web/src/modules/analytics/tracking.ts`

## Quick checks
- Web build: `cd apps/web && npm run build`
- API lint/test (if configured): `cd apps/api && npm test`
- Merge-marker scan: `rg -n "< < < < < < <|> > > > > > >|= = = = = = =" .`
