const storageKey = "teaAuction.apiKey";

let apiKey = import.meta.env.VITE_API_KEY || sessionStorage.getItem(storageKey) || "";
const listeners = new Set<() => void>();

function publish() {
  listeners.forEach((listener) => listener());
}

export function getApiKey() {
  return apiKey;
}

export function setApiKey(value: string) {
  apiKey = value.trim();
  sessionStorage.setItem(storageKey, apiKey);
  publish();
}

export function subscribeApiKey(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
