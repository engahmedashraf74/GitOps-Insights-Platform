import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DeploymentAnalysis } from "@/services/billing";
import type { ApplicationEvent, Deployment } from "@/types";
import { formatUtcDateTime } from "./format";
import {
  actionNotes,
  actionSteps,
  buildEvidence,
  buildWindowStats,
  compareLatestDeployments,
  deploymentOutcomeSummary,
  failureDirection,
  situationFor,
} from "./intelligence";

function deployment(overrides: Partial<Deployment>): Deployment {
  return {
    revision: "abc123",
    status: "Succeeded",
    healthStatus: null,
    syncStatus: null,
    stateRecorded: false,
    deployedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

const analysis = {
  healthStatus: "Degraded",
  syncStatus: "Synced",
  rootCause: "The latest sync completed successfully, but the deployed workload is unhealthy.",
  recommendedFix: "Check the new pods, readiness/liveness probes, container startup, and the Deployment progress deadline.",
  confidence: 85,
} as DeploymentAnalysis;

describe("deployment intelligence", () => {
  it("keeps nine succeeded and one failed at 90 percent, risk 38, stability 82", () => {
    const rows = [
      ...Array.from({ length: 9 }, (_, index) =>
        deployment({
          revision: `ok-${index}`,
          status: "Succeeded",
          deployedAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
        }),
      ),
      deployment({
        revision: "bad",
        status: "Failed",
        healthStatus: "Degraded",
        syncStatus: "Synced",
        stateRecorded: true,
        deployedAt: "2026-10-02T00:00:00.000Z",
      }),
    ];
    const stats = buildWindowStats(rows, analysis, [
      {
        id: 1,
        type: "Health",
        message: "Deployment/example exceeded its progress deadline",
        createdAt: "2026-10-02T00:00:00.000Z",
        applicationId: 1,
      },
    ]);
    assert.equal(stats?.deploymentCount, 10);
    assert.equal(stats?.successfulDeployments, 9);
    assert.equal(stats?.failedDeploymentCount, 1);
    assert.equal(stats?.successRate, 90);
    assert.equal(stats?.riskScore, 38);
    assert.equal(stats?.stabilityScore, 82);
  });

  it("uses a stored event message as evidence and does not invent a resource", () => {
    const events: ApplicationEvent[] = [
      {
        id: 1,
        type: "Workload",
        message: "Deployment/example exceeded its progress deadline",
        createdAt: "2026-10-02T00:00:00.000Z",
        applicationId: 1,
      },
    ];
    const evidence = buildEvidence(analysis, events, deployment({ status: "Failed" }));
    const event = evidence.find((item) => item.signal === "Workload");
    assert.equal(event?.value, "Deployment/example exceeded its progress deadline");
    assert.match(event?.interpretation ?? "", /progress deadline/);
    assert.equal(evidence.some((item) => item.value === "gitops-ai-failure-test"), false);
  });

  it("does not treat missing health as a Healthy to Degraded change", () => {
    const comparison = compareLatestDeployments([
      deployment({
        revision: "new",
        healthStatus: "Degraded",
        syncStatus: "Synced",
        deployedAt: "2026-10-02T00:00:00.000Z",
      }),
      deployment({
        revision: "old",
        status: "Succeeded",
        healthStatus: null,
        syncStatus: null,
        deployedAt: "2026-09-01T00:00:00.000Z",
      }),
    ]);
    assert.equal(comparison?.changes.some((change) => change.startsWith("Health")), false);
    assert.equal(comparison?.rows.find((row) => row.label === "Health")?.previous, "Not recorded");
    assert.equal(comparison?.changes.some((change) => change.includes("Revision")), true);
  });

  it("splits only the progress-deadline guidance the engine already returns", () => {
    assert.deepEqual(situationFor("Degraded", "Synced", analysis.rootCause), "degraded");
    assert.deepEqual(actionSteps(analysis.recommendedFix, false), [
      "Check the new pods.",
      "Check readiness/liveness probes.",
      "Check container startup.",
      "Check the Deployment progress deadline.",
    ]);
    assert.deepEqual(actionSteps("Inspect application logs manually.", true), []);
  });

  it("counts failed results and observed degraded health separately", () => {
    const text = deploymentOutcomeSummary([
      deployment({ status: "Failed", healthStatus: "Degraded" }),
      deployment({ revision: "b", status: "Succeeded", healthStatus: "Degraded" }),
      deployment({ revision: "c", status: "Succeeded", healthStatus: null }),
    ]);
    assert.equal(
      text,
      "1 stored deployment failed; 2 stored deployments were observed as degraded.",
    );
    assert.deepEqual(
      actionNotes(
        ["Check the new pods.", "1 of 13 stored deployments are failed or degraded."],
        "Check the new pods.",
      ),
      [],
    );
  });

  it("keeps the UTC instant available without changing the local display zone", () => {
    const utc = formatUtcDateTime("2026-10-04T00:54:00.000Z");
    assert.match(utc, /00:54/);
    assert.match(utc, /UTC/);
  });

  it("states a failure direction only from stored results", () => {
    const text = failureDirection([
      deployment({ status: "Succeeded", deployedAt: "2026-09-01T00:00:00.000Z" }),
      deployment({ status: "Failed", deployedAt: "2026-10-02T00:00:00.000Z" }),
    ]);
    assert.match(text ?? "", /later half of this window \(1\)/);
    assert.match(text ?? "", /earlier half \(0\)/);
  });
});
