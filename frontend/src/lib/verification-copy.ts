export type VerificationNotice = {
  tone: "warning" | "neutral";
  text: string;
};

export function registerVerificationNotice(
  delivery: string | null | undefined,
): VerificationNotice {
  if (delivery === "unavailable") {
    return {
      tone: "warning",
      text: "Your account was created, but the verification email could not be sent. Use resend in a few minutes.",
    };
  }
  return {
    tone: "neutral",
    text: "Your account was created. The mail provider accepted the verification request. Check your inbox and spam. Acceptance does not confirm the message reached your inbox.",
  };
}

export function resendVerificationNotice(
  delivery: string | null | undefined,
): VerificationNotice {
  if (delivery === "unavailable") {
    return {
      tone: "warning",
      text: "The verification email could not be sent right now. Try again in a few minutes.",
    };
  }
  return {
    tone: "neutral",
    text: "If that account needs verification, the mail provider accepted the request. Check spam if it does not arrive. Acceptance does not confirm inbox delivery.",
  };
}
