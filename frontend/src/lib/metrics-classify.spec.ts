import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyDeployment } from "./metrics";
import type { Deployment } from "@/types";

function row(
  status: string,
  healthStatus: string | null,
  syncStatus: string | null,
  stateRecorded: boolean,
): Deployment {
  return {
    revision: "abc",
    status,
    healthStatus,
    syncStatus,
    stateRecorded,
  };
}

describe("deployment result metrics", () => {
  it("counts Succeeded with no snapshot as success", () => {
    assert.equal(
      classifyDeployment(row("Succeeded", null, null, false)),
      "success",
    );
  });

  it("counts Failed with a recorded snapshot as failed", () => {
    assert.equal(
      classifyDeployment(row("Failed", "Degraded", "Synced", true)),
      "failed",
    );
  });

  it("keeps nine succeeded and one failed at 90 percent with risk 38 and stability 82", () => {
    const rows = [
      ...Array.from({ length: 9 }, () => row("Succeeded", null, null, false)),
      row("Failed", "Degraded", "Synced", true),
    ];
    const succeeded = rows.filter((item) => classifyDeployment(item) === "success").length;
    const failed = rows.filter((item) => classifyDeployment(item) === "failed").length;
    const successRate = Number(((succeeded / rows.length) * 100).toFixed(1));
    const riskScore = Math.max(0, Math.min(100, 35 + Math.round((failed / rows.length) * 30)));
    const stabilityScore = Math.max(
      0,
      Math.min(100, Math.round(successRate * 0.7 + (100 - riskScore) * 0.3)),
    );

    assert.equal(rows.length, 10);
    assert.equal(succeeded, 9);
    assert.equal(failed, 1);
    assert.equal(successRate, 90);
    assert.equal(riskScore, 38);
    assert.equal(stabilityScore, 82);
  });
});