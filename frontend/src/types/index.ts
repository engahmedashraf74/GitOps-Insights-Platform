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
}

export interface ApplicationRepository {
  id: number;
  name: string;
  repoUrl: string | null;
  branch: string | null;
  path: string | null;
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

export interface ApplicationOverview {
  stats: DashboardStats;
  frequency: DeploymentFrequency;
  failureRate: FailureRate;
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
