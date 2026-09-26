import { createApiClient } from '@medifyrx/shared';
import { fetch as streamingFetch } from 'expo/fetch';

export const api = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000', undefined, streamingFetch);
