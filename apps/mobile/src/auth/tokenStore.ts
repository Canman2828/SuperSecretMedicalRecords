// Where the sign-in token lives (web: localStorage for "Remember me", sessionStorage otherwise).
//   remember = true  -> iOS Keychain via expo-secure-store, so it survives app restarts
//   remember = false -> memory only, gone when the app closes
// expo-secure-store is a native module. On a dev build made before it was added, the require
// fails and we quietly fall back to memory only; rebuild the dev client to get persistence.

const KEY = 'medifyrx.token';

type SecureStore = typeof import('expo-secure-store');
let store: SecureStore | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  store = require('expo-secure-store') as SecureStore;
} catch {
  store = null;
}

let current: string | null = null;

/** Synchronous, for the API client's Authorization header. */
export const getToken = () => current;

/** Read a remembered token at launch. */
export async function loadToken(): Promise<string | null> {
  try {
    current = (await store?.getItemAsync(KEY)) ?? null;
  } catch {
    current = null;
  }
  return current;
}

export async function setToken(token: string | null, remember = true) {
  current = token;
  try {
    if (token && remember) await store?.setItemAsync(KEY, token);
    else await store?.deleteItemAsync(KEY);
  } catch {
    /* keychain unavailable: memory only */
  }
}
