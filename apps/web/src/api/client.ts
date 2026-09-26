import { createApiClient } from '@clearrx/shared';

const TOKEN_KEY = 'clearrx.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode etc. */
  }
}

export const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:4000', getToken);
