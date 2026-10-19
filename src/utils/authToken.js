const TOKEN_KEY = "accTkn";

export function getAuthToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    return token && token !== "undefined" && token !== "null" && token.trim()
      ? token
      : null;
  } catch {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token && token !== "undefined" && token !== "null") {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Cookie-based sessions still work when browser storage is unavailable.
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Clearing in-memory auth state is still enough to sign out this tab.
  }
}
