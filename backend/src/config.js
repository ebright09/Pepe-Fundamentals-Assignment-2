import 'dotenv/config';

/**
 * Server-only configuration.
 *
 * Nothing here is ever sent to the browser. In particular DATABASE_URL is not
 * read at all by the running API: every read and write goes through the Neon
 * Data API using the caller's own JWT, so Row Level Security is the thing that
 * decides what is visible. The API has no privileged database credential to
 * leak and no way to bypass a policy.
 */

const required = (name, fallback = undefined) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        'Copy .env.example to backend/.env and fill in the values from your Neon project.'
    );
  }
  return value;
};

const stripTrailingSlash = (url) => url.replace(/\/+$/, '');

/**
 * Neon publishes the auth service's signing keys at
 * `<auth base>/.well-known/jwks.json` (Ed25519/EdDSA). An explicit
 * NEON_AUTH_JWKS_URL overrides this if Neon ever moves it.
 */
const deriveJwksUrl = (authBaseUrl) =>
  process.env.NEON_AUTH_JWKS_URL ||
  `${stripTrailingSlash(authBaseUrl)}/.well-known/jwks.json`;

export const loadConfig = () => {
  const authBaseUrl = stripTrailingSlash(required('NEON_AUTH_BASE_URL'));

  return {
    port: Number(process.env.PORT || 8787),
    isProduction: process.env.NODE_ENV === 'production',
    authBaseUrl,
    jwksUrl: deriveJwksUrl(authBaseUrl),
    dataApiUrl: stripTrailingSlash(required('NEON_DATA_API_URL')),
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
};
