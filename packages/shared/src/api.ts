import type {
  ChatRequest,
  ChatStreamEvent,
  DrugSearchResult,
  ExplainRequest,
  ExplainResponse,
  InteractionCheckRequest,
  InteractionCheckResponse,
  MedicationUsesRequest,
  MedicationUsesResponse,
  Profile,
  TranslateRequest,
  TranslateResponse,
} from './types';

/**
 * Tiny fetch wrapper used by both the web app and the iOS app.
 *   web:    createApiClient(import.meta.env.VITE_API_URL)
 *   mobile: createApiClient(process.env.EXPO_PUBLIC_API_URL)
 */
export function createApiClient(
  baseUrl: string,
  getToken?: () => string | null | undefined,
  streamingFetch: (url: string, init?: RequestInit) => Promise<Response> = fetch,
) {
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

    /** Plain-language / translated version of scanned text. Protected values come back unchanged. */
    translate: (body: TranslateRequest) =>
      request<TranslateResponse>('/api/translate', { method: 'POST', body: JSON.stringify(body) }),

    /** What each medication is used for, condensed from the official FDA label (sourced, cites DailyMed). */
    medicationUses: (body: MedicationUsesRequest) =>
      request<MedicationUsesResponse>('/api/medications/uses', { method: 'POST', body: JSON.stringify(body) }),

    register: (body: { name: string; email: string; password: string }) =>
      request<{ token: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

    login: (body: { email: string; password: string }) =>
      request<{ token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

    /** Emails a reset link if the account exists. Resolves the same way either way. */
    forgotPassword: (email: string) =>
      request<{ ok: true }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

    /** Sets a new password from an emailed reset link and signs the user in. */
    resetPassword: (body: { token: string; password: string }) =>
      request<{ token: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),

    getProfile: () => request<Profile>('/api/profile'),

    /** Only call this after the user explicitly opts in to saving. */
    saveProfile: (profile: Profile) =>
      request<Profile>('/api/profile', { method: 'PUT', body: JSON.stringify(profile) }),
    /**
     * Stream a medication-chat reply. Calls `onText` with each chunk and resolves with the full reply.
     * Native clients supply expo/fetch as streamingFetch; browsers use their default fetch.
     */
    chat: async (body: ChatRequest, onText: (chunk: string) => void, signal?: AbortSignal) => {
      const res = await streamingFetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          if (!frame.startsWith('data: ')) continue;
          const event = JSON.parse(frame.slice(6)) as ChatStreamEvent;
          if (event.type === 'text') onText(event.text);
          else if (event.type === 'done') return event.text;
          else throw new Error(event.message);
        }
      }
      throw new Error('The reply was cut off. Please try again.');
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
