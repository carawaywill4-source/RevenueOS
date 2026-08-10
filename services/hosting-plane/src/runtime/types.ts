export type RuntimeKind = "docker" | "process";

export type SiteLimits = {
  cpuMillicores: number;
  memoryMb: number;
  diskMb: number;
};

export type SiteRuntimeRecord = {
  siteId: string;
  version: string;
  deploymentId: string;
  runtimeKind: RuntimeKind;
  status: "starting" | "healthy" | "degraded" | "failed" | "stopped" | "retired";
  port: number;
  /** Previous known-good version kept for rollback. */
  previousDeploymentId?: string;
  previousPort?: number;
  /** Primary domain (first of domains). */
  domain?: string;
  /** All attached hostnames for gateway routing. */
  domains: string[];
  createdAt: string;
  lastDeployAt: string;
  lastHealthAt?: string;
  lastHealthOk?: boolean;
  limits: SiteLimits;
  envKeys: string[];
  appDir: string;
  reason?: string;
  hypothesis?: string;
  containerId?: string;
  pid?: number;
};

export type DeployRequest = {
  siteId: string;
  appDir: string;
  version: string;
  reason: string;
  hypothesis?: string;
  domain?: string;
  env: Record<string, string>;
  limits?: Partial<SiteLimits>;
};

export type DeployResult = {
  ok: boolean;
  deploymentId: string;
  siteId: string;
  version: string;
  port?: number;
  publicUrl?: string;
  detail: string;
  verification: Record<string, unknown>;
  rolledBackTo?: string;
};

export type RuntimeAdapter = {
  kind: RuntimeKind;
  available(): Promise<boolean>;
  start(input: {
    siteId: string;
    deploymentId: string;
    appDir: string;
    port: number;
    env: Record<string, string>;
    limits: SiteLimits;
  }): Promise<{ ok: boolean; detail: string; pid?: number; containerId?: string }>;
  stop(input: {
    siteId: string;
    deploymentId: string;
    pid?: number;
    containerId?: string;
    port: number;
  }): Promise<void>;
  stats?(siteId: string): Promise<{ cpuPct?: number; memoryMb?: number }>;
};
