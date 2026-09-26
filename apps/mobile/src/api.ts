import { createApiClient } from '@clearrx/shared';

export const api = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000');
