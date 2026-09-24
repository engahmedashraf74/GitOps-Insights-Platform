export type HealthStatus =
  | "Healthy"
  | "Progressing"
  | "Degraded"
  | "Missing"
  | "Unknown";

export type SyncStatus = "Synced" | "OutOfSync" | "Unknown";

export type DeploymentStatus =
  | "Succeeded"
  | "Failed"
  | "Running"
  | "Pending"
  | string;

export interface User {
  id: number;
  email: string;
  username?: string;
}

export interface AuthResponse {
  access_token: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  createdAt?: string;
  userId?: number;
}

export interface Application {
  id: number;
  name: string;
  description: string | null;
  repoUrl: string | null;
  branch: string | null;
  path: string | null;
  projectId: number;
  createdAt?: string;
  namespace?: string | null;
  cluster?: string | null;
  syncStatus?: string | null;
  healthStatus?: string | null;
  revision?: string | null;
  lastObservedAt?: string | null;
}

export interface ApplicationRepository {
  id: number;
  name: string;
  repoUrl: string | null;
  branch: string | null;
  path: string | null;
  namespace?: string | null;
  cluster?: string | null;
}

export interface Environment {
  id: number;
  name: string;
  createdAt?: string;
  applicationId: number;
}

export interface Deployment {
  id?: number;
  revision: string;
  status: DeploymentStatus;
  syncStatus?: string | null;
  healthStatus?: string | null;
  environment?: string;
  deployedAt?: string;
  commitSha?: string | null;
  applicationId?: number;
}

export interface DashboardStats {
  totalDeployments: number;
  healthyDeployments: number;
  failedDeployments: number;
  successRate: number | string;
}

export interface FailureRate {
  totalDeployments?: number;
  failedDeployments?: number;
  failureRate: number | string;
}

export interface DeploymentFrequency {
  deployments: number;
}

export interface ApplicationCurrentState {
  health: string;
  sync: string;
  revision: string;
  repoUrl: string;
  namespace: string;
  cluster: string;
  lastDeployment: string | null;
}

export interface ApplicationOverview {
  application?: Application;
  stats: DashboardStats;
  frequency: DeploymentFrequency;
  failureRate: FailureRate;
  current?: ApplicationCurrentState;
  timeline: Deployment[];
}

export interface WorkspaceMetrics {
  applications: number;
  deployments: number;
  healthyApplications: number;
  failedDeployments: number;
  successRate: number;
}

export interface ActivityPoint {
  label: string;
  deployments: number;
}

export interface HealthBreakdown {
  healthy: number;
  degraded: number;
  progressing: number;
}

export type IntegrationProvider =
  | "argocd"
  | "github"
  | "gitlab"
  | "bitbucket"
  | "slack";

export type IntegrationStatus = "connected" | "disconnected" | "coming_soon";

export interface Integration {
  provider: IntegrationProvider;
  name: string;
  description: string;
  status: IntegrationStatus;
  url?: string;
  lastSyncedAt?: string;
  connected?: boolean;
}

export interface UserPreferences {
  username: string;
  theme: "dark" | "system";
  timezone: string;
  defaultProjectId: number | null;
  notifications: {
    email: boolean;
    deploymentFailures: boolean;
    weeklySummary: boolean;
  };
}

export interface WorkspaceContext {
  name: string;
}

export type TimeRange = "7d" | "30d" | "90d";

export type MetricSource = "api" | "derived" | "unavailable";

export interface DoraMetric {
  key: "deploymentFrequency" | "leadTime" | "changeFailureRate" | "mttr";
  label: string;
  value: string;
  hint: string;
  source: MetricSource;
}

export interface DoraMetrics {
  deploymentFrequency: DoraMetric;
  leadTime: DoraMetric;
  changeFailureRate: DoraMetric;
  mttr: DoraMetric;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  href?: string;
  read: boolean;
  tone: "info" | "warning" | "danger" | "success";
  source: "derived" | "demo";
}

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  group: "Pages" | "Projects" | "Applications" | "Deployments";
}

export interface SuccessFailurePoint {
  label: string;
  succeeded: number;
  failed: number;
}

export interface EnvironmentComparison {
  environment: string;
  deployments: number;
  failures: number;
}
