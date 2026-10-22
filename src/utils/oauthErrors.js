// Human-readable messages for the OAuth flow. Auth0 reports URL-level errors
// (cancelled login, callback mismatch, expired session) and the backend
// reports account-state errors (pending / rejected / inactive).
export function describeAuth0UrlError(code, description) {
  const value = String(code || "").toLowerCase();
  const detail = String(description || "").trim();

  if (/callback url mismatch/i.test(detail)) {
    const origin = typeof window !== "undefined" ? window.location.origin : "this app's URL";
    return `Sign-in was blocked because this URL is not allowed in Auth0. Add ${origin} to the application's Allowed Callback URLs, then try again.`;
  }

  switch (value) {
    case "access_denied":
      return "Sign-in was cancelled. You can try again whenever you are ready.";
    case "unauthorized":
      return "This account is not allowed to sign in. Contact an administrator.";
    case "login_required":
      return "Please sign in again to continue.";
    case "consent_required":
      return "Sign-in permission was not granted. Please try again.";
    case "invalid_state":
    case "state_mismatch":
      return "The sign-in session expired. Please try again.";
    case "temporarily_unavailable":
      return "The sign-in provider is temporarily unavailable. Please try again in a moment.";
    case "invalid_request":
      return detail || "Sign-in could not be completed. Please try again.";
    default:
      return detail || "Sign-in failed. Please try again.";
  }
}

// Maps a failed POST /auth/oauth call to a message the user can act on.
// tone: "info" for expected states (pending approval), "error" otherwise.
export function describeOAuthFailure(error) {
  const status = Number(error?.response?.status || 0);
  const data = error?.response?.data || {};
  const backendMessage = String(data.message || data.error || "").trim();
  const lower = backendMessage.toLowerCase();

  if (!error?.response) {
    return {
      message: "Could not connect to the server. Check your connection and try again.",
      tone: "error",
      pending: false,
    };
  }

  const pending =
    data.pending === true ||
    data.status === "pending" ||
    lower.includes("pending") ||
    lower.includes("approval") ||
    (status === 403 && lower.includes("waiting"));

  if (pending) {
    return {
      message:
        "Your account is awaiting admin approval. You can sign in once an administrator approves it.",
      tone: "info",
      pending: true,
    };
  }

  if (status === 403) {
    if (lower.includes("reject")) {
      return {
        message:
          "Your account was rejected by the administrator. Contact support if you believe this is a mistake.",
        tone: "error",
        pending: false,
      };
    }
    if (
      lower.includes("inactive") ||
      lower.includes("disabled") ||
      lower.includes("deactivat") ||
      lower.includes("suspend")
    ) {
      return {
        message: "Your account is inactive. Contact an administrator to restore access.",
        tone: "error",
        pending: false,
      };
    }
    return {
      message: backendMessage || "Your account is not allowed to sign in. Contact an administrator.",
      tone: "error",
      pending: false,
    };
  }

  if (status === 401) {
    return { message: "Login failed. Please try again.", tone: "error", pending: false };
  }

  return {
    message: backendMessage || "Sign-in failed. Please try again.",
    tone: "error",
    pending: false,
  };
}
