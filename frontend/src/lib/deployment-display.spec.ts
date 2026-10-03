import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shownResult, shownSnapshot } from "./deployment-display";

describe("deployment snapshot labels", () => {
  it("shows Result Succeeded and Not recorded when health and sync are null", () => {
    assert.equal(shownResult("Succeeded"), "Succeeded");
    assert.equal(shownSnapshot(null), "Not recorded");
    assert.equal(shownSnapshot(null), "Not recorded");
    assert.equal(shownSnapshot("Unknown"), "Unknown");
    assert.equal(shownSnapshot("Degraded"), "Degraded");
  });
});
