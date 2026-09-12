# GitOps Insights API contract

Base URL: cluster NodePort or `NEXT_PUBLIC_API_URL`.  
Auth: `Authorization: Bearer <access_token>` on every business route.  
Docs: `GET /api/docs`.

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/about` | Service metadata |
| POST | `/auth/register` | `{ email, password, username? }` → `{ access_token }` |
| POST | `/auth/login` | `{ email }` may be email **or** username → `{ access_token }` |

JWT payload is unchanged: `{ userId, email }`.

## Workspace (eliminates frontend N+1)

| Method | Path |
|---|---|
| GET | `/workspace` |
| PATCH | `/workspace` `{ name }` |
| GET | `/workspace/snapshot` |
| GET | `/workspace/metrics` |
| GET | `/workspace/activity?range=7d\|30d\|90d` |
| GET | `/workspace/health` |
| GET | `/workspace/dora` |
| GET | `/workspace/environments` |
| GET | `/workspace/search?q=` |
| GET | `/workspace/notifications` |
| PATCH | `/workspace/notifications/read` `{ ids?: number[] }` |

DORA fields: `value`, `source` (`api` \| `unavailable`), `hint`, `trend`.

## Projects

| Method | Path | Notes |
|---|---|---|
| GET | `/projects` | Argo CD projects created during application sync |
| POST | `/projects` | **Removed.** Returns 400 — projects come from Argo CD |

## Applications

| Method | Path | Notes |
|---|---|---|
| POST | `/applications/sync` | Discover Argo CD apps and upsert metadata + history |
| GET | `/applications` | Imported applications (includes health/sync/revision/namespace/cluster) |
| POST | `/applications` | **Removed.** Returns 400 — use sync |
| GET | `/applications/by-id/:id` | Single app |
| GET | `/applications/:id/overview` | Live Argo overlay + cached history |
| GET | `/applications/:id/repository` | Repo, namespace, cluster from Argo metadata |
| GET | `/applications/:id/events` | ApplicationEvent rows |
| GET | `/applications/repository/:id` | Legacy alias |
| GET | `/applications/:projectId` | **Legacy** list-by-project |

`GET /workspace/snapshot` includes `argocd: { connected, url, lastSyncedAt }`.

A scheduled job syncs every 5 minutes for connected organizations.

## Deployments

| Method | Path | Notes |
|---|---|---|
| GET | `/deployments` | Filters: `applicationId`, `status`, `environment`, `from`, `to` |
| POST | `/deployments` | Existing create + optional `commitSha`, `environmentId`, sync/health |
| GET | `/deployments/by-id/:id` | Single deployment |
| PATCH | `/deployments/:id` | Status / sync / health |
| GET | `/deployments/:applicationId` | **Legacy** list-by-application used by current frontend |

## Environments (existing)

| Method | Path |
|---|---|
| POST | `/environments` `{ name, applicationId }` |
| GET | `/environments/:applicationId` |
| DELETE | `/environments/:id` |

## Dashboard (existing, now per-application)

| Method | Path |
|---|---|
| GET | `/dashboard/overview/:applicationId` |
| GET | `/dashboard/stats/:applicationId` |
| GET | `/dashboard/timeline/:applicationId` |
| GET | `/dashboard/failure-rate/:applicationId` |
| GET | `/dashboard/frequency/:applicationId` |

Overview no longer hardcodes `gitops-insights`. Timeline includes `environment` and `applicationId`.

## Integrations

| Method | Path | Notes |
|---|---|---|
| GET | `/integrations` | Never returns tokens |
| POST | `/integrations/argocd/test` | `{ url, token }` — token not stored |
| POST | `/integrations/argocd/connect` | Encrypts token at rest |
| DELETE | `/integrations/argocd` | |

Env `ARGOCD_TOKEN` / `ARGOCD_URL` remain the fallback when no org integration exists.

## Settings

| Method | Path |
|---|---|
| GET | `/users/me` |
| PATCH | `/users/me` `{ username }` |
| PATCH | `/users/me/preferences` |
| PATCH | `/users/me/password` `{ currentPassword, newPassword }` |
| GET | `/users` | Public fields only |
| POST | `/users` | JWT required |

## Secrets

- `INTEGRATION_ENCRYPTION_KEY` (optional, 32+ chars) encrypts Argo tokens.
- `JWT_SECRET` defaults to `my-secret-key` so existing tokens keep working.
