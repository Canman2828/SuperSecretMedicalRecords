import { createApiClient } from '@medifyrx/shared';

const TOKEN_KEY = 'medifyrx.token';

// "Remember me" keeps the token in localStorage; otherwise it lives only for this tab (sessionStorage).
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null, remember = true) {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    /* private mode etc. */
  }
}

export const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:4000', getToken);
