// Auth0 redirects back with ?code=...&state=... (or ?error=...). The SDK
// removes those params from the URL while it processes them, so capture them
// once at module load — before React renders and before the SDK cleans up.
function readUrlParams() {
  if (typeof window === "undefined") {
    return { code: null, state: null, error: null, description: null };
  }

  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const pick = (key) => search.get(key) || hash.get(key);

  return {
    code: pick("code"),
    state: pick("state"),
    error: pick("error"),
    description: pick("error_description"),
  };
}

const initialParams = readUrlParams();

// True only for the page load that actually came back from Auth0.
export const auth0CallbackOnLoad = Boolean(
  initialParams.error || (initialParams.code && initialParams.state),
);

// The root route ("/") immediately redirects guests to /signin. That redirect
// drops the Auth0 ?code=&state= query string, and the SDK can no longer finish
// the token exchange. Callers can use this helper to hold their redirect until
// the SDK has consumed the callback params.
export function hasAuth0CallbackParams() {
  const current = readUrlParams();
  return Boolean(current.error || (current.code && current.state));
}

// Returns the Auth0 error carried in the URL, if any. Falls back to the values
// captured at load time because the SDK may already have cleaned the URL.
export function readAuth0UrlError() {
  const current = readUrlParams();
  const error = current.error || initialParams.error;
  if (!error) return null;

  return {
    error,
    description: current.description || initialParams.description || "",
  };
}
