/** Where members can reach the ProfileHUB team about privacy, safety or misuse. */
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@profilehub.dev';

export const LEGAL_UPDATED = '28 October 2026';

/** Typed in chat, these usually mean someone is being asked for something they should never share. */
export const SENSITIVE_PATTERN =
  /\b(otp|one[- ]time (pass)?code|password|passcode|pin|cvv|upi|bank account|account number|ifsc|aadhaar|pan card|card number)\b/i;
