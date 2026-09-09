/**
 * Isolated demo/preview data.
 * Never mix this with live API responses silently.
 * Replace or delete this module when backend workspace analytics exist.
 */
import type { Integration } from "@/types";

export const DEMO_SOURCE = "demo" as const;

export const landingPreviewApps = [
  {
    name: "payments-api",
    environment: "production",
    health: "Healthy",
    sync: "Synced",
    revision: "a91c2e4",
  },
  {
    name: "checkout-service",
    environment: "staging",
    health: "Progressing",
    sync: "Synced",
    revision: "b33f901",
  },
  {
    name: "web-frontend",
    environment: "production",
    health: "Healthy",
    sync: "OutOfSync",
    revision: "c12ab88",
  },
  {
    name: "auth-service",
    environment: "development",
    health: "Degraded",
    sync: "OutOfSync",
    revision: "d77e210",
  },
];

export const integrationCatalog: Integration[] = [
  {
    provider: "argocd",
    name: "Argo CD",
    description:
      "Sync GitOps applications, health, and revision state from your Argo CD instance.",
    status: "disconnected",
  },
  {
    provider: "github",
    name: "GitHub",
    description: "Link repositories and deployment commits to application history.",
    status: "coming_soon",
  },
  {
    provider: "gitlab",
    name: "GitLab",
    description: "Track merge activity and GitOps manifests across GitLab projects.",
    status: "coming_soon",
  },
  {
    provider: "bitbucket",
    name: "Bitbucket",
    description: "Connect Bitbucket repositories used by your delivery pipelines.",
    status: "coming_soon",
  },
  {
    provider: "slack",
    name: "Slack",
    description: "Route deployment failure alerts to the channels your team already uses.",
    status: "coming_soon",
  },
];

export const insightPlaceholders = [
  {
    title: "Delivery intelligence",
    body: "Reliability signals and failure clustering will appear here once workspace analytics are available from the API.",
  },
  {
    title: "Change risk",
    body: "Revision-level risk scoring is not enabled in this release. The layout is ready for a future backend payload.",
  },
];
