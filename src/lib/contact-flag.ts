// Shared flag to suppress the contact popup once a user has given us their info.
// Persisted in localStorage so it survives refresh + future visits on the same device.
const KEY = "luveni:contact_submitted";

export function hasSubmittedContact(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markContactSubmitted() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}
