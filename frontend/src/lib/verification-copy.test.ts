import assert from "node:assert/strict";
import test from "node:test";
import {
  registerVerificationNotice,
  resendVerificationNotice,
} from "./verification-copy.ts";

test("register explains a provider failure without claiming inbox delivery", () => {
  const failed = registerVerificationNotice("unavailable");
  assert.equal(failed.tone, "warning");
  assert.match(failed.text, /could not be sent/);
  assert.doesNotMatch(failed.text, /delivered/);

  const accepted = registerVerificationNotice("accepted");
  assert.match(accepted.text, /accepted/);
  assert.match(accepted.text, /does not confirm/);
});

test("resend copy does not reveal whether an account exists", () => {
  for (const delivery of ["accepted", "unavailable", null]) {
    const notice = resendVerificationNotice(delivery);
    assert.doesNotMatch(notice.text, /account exists/i);
    assert.doesNotMatch(notice.text, /token=/i);
  }
  assert.match(resendVerificationNotice("unavailable").text, /could not be sent/);
  assert.match(resendVerificationNotice("accepted").text, /needs verification/);
});
