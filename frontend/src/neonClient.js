import { createClient } from '@neondatabase/neon-js';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

/**
 * The Neon client, created with the two-URL object form: one URL for Managed
 * Better Auth and one for the Data API.
 *
 * Both are public HTTPS endpoints and are safe in the browser bundle — they are
 * protected by Row Level Security, so possessing the URL grants nothing without
 * a valid token, and a valid token only ever reaches that user's own rows.
 *
 * Note that this app uses the client for AUTHENTICATION ONLY. Contact reads and
 * writes go to our own Node API, which validates them and then calls the Data
 * API on the user's behalf.
 */

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL;

export const isConfigured = Boolean(authUrl && dataApiUrl);

export const missingConfigMessage =
  'Set VITE_NEON_AUTH_URL and VITE_NEON_DATA_API_URL in frontend/.env.local — ' +
  'copy .env.example and fill in the two URLs from your Neon project.';

export const neon = isConfigured
  ? createClient({
      auth: { url: authUrl, adapter: BetterAuthReactAdapter() },
      dataApi: { url: dataApiUrl },
    })
  : null;
