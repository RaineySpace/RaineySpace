export const SENIOR_MODE_STORAGE_KEY = "senior-mode";
export const SENIOR_MODE_CLASS = "senior-mode";
export const SENIOR_MODE_CHANGE_EVENT = "senior-mode-change";

export const SENIOR_MODE_BOOTSTRAP_SCRIPT = `(function(){try{if(localStorage.getItem("${SENIOR_MODE_STORAGE_KEY}")==="1")document.documentElement.classList.add("${SENIOR_MODE_CLASS}");}catch(e){}})();`;

export function isSeniorModeEnabled() {
  return document.documentElement.classList.contains(SENIOR_MODE_CLASS);
}

export function setSeniorModeEnabled(enabled: boolean) {
  document.documentElement.classList.toggle(SENIOR_MODE_CLASS, enabled);
  try {
    localStorage.setItem(SENIOR_MODE_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore quota / private-mode failures; the in-session class still applies.
  }
  window.dispatchEvent(new Event(SENIOR_MODE_CHANGE_EVENT));
}
