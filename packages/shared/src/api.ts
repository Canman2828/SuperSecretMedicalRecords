import type {
  DrugSearchResult,
  ExplainRequest,
  ExplainResponse,
  InteractionCheckRequest,
  InteractionCheckResponse,
  Profile,
} from './types';

/**
 * Tiny fetch wrapper used by both the web app and the iOS app.
 *   web:    createApiClient(import.meta.env.VITE_API_URL)
 *   mobile: createApiClient(process.env.EXPO_PUBLIC_API_URL)
 */
export function createApiClient(baseUrl: string, getToken?: () => string | null | undefined) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getToken?.();
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${body}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    searchDrugs: (q: string) =>
      request<{ results: DrugSearchResult[] }>(`/api/drugs/search?q=${encodeURIComponent(q)}`),

    checkInteractions: (body: InteractionCheckRequest) =>
      request<InteractionCheckResponse>('/api/interactions/check', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    explain: (body: ExplainRequest) =>
      request<ExplainResponse>('/api/explain', { method: 'POST', body: JSON.stringify(body) }),

    register: (body: { name: string; email: string; password: string }) =>
      request<{ token: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

    login: (body: { email: string; password: string }) =>
      request<{ token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

    getProfile: () => request<Profile>('/api/profile'),

    /** Only call this after the user explicitly opts in to saving. */
    saveProfile: (profile: Profile) =>
      request<Profile>('/api/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
