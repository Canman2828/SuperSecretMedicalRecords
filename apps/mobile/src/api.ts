import { createApiClient } from '@medifyrx/shared';
import { fetch as streamingFetch } from 'expo/fetch';
import { getToken } from './auth/tokenStore';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

// getToken adds the signed-in user's Bearer token (needed for /api/profile and /api/documents).
// expo/fetch streams the /api/chat SSE response, which React Native's default fetch can't.
export const api = createApiClient(API_URL, getToken, streamingFetch);
