const INITIAL_LOADER_KEY = "nexora:initial-loader-shown";

export function hasShownInitialLoader() {
  try {
    return window.sessionStorage.getItem(INITIAL_LOADER_KEY) === "1";
  } catch {
    return false;
  }
}

export function markInitialLoaderShown() {
  try {
    window.sessionStorage.setItem(INITIAL_LOADER_KEY, "1");
  } catch {
    // The loader still works for this page even when storage is unavailable.
  }
}
