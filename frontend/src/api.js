import { getAccessToken } from './auth.js';

/**
 * Client for our own Node API.
 *
 * Every call attaches the current Neon access token. The API verifies that
 * token, validates the payload, and forwards the request to Postgres as this
 * user — so the browser is never the thing deciding what data it may see.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787').replace(/\/+$/, '');

/** An error carrying the API's per-field messages, for inline form display. */
export class ApiRequestError extends Error {
  constructor(message, { status, fields } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.fields = fields ?? {};
  }
}

const request = async (path, { method = 'GET', body } = {}) => {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiRequestError('Your session has ended. Please sign in again.', { status: 401 });
  }

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(
      'Could not reach the server. Check your connection and try again.',
      { status: 0 }
    );
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiRequestError(payload?.error ?? 'Something went wrong. Please try again.', {
      status: response.status,
      fields: payload?.fields,
    });
  }
  return payload;
};

export const listContacts = ({ sort, order, priority, q }) => {
  const params = new URLSearchParams();
  if (sort) params.set('sort', sort);
  if (order) params.set('order', order);
  if (priority && priority !== 'all') params.set('priority', priority);
  if (q?.trim()) params.set('q', q.trim());
  const query = params.toString();
  return request(`/api/contacts${query ? `?${query}` : ''}`).then((r) => r.contacts ?? []);
};

export const createContact = (values) =>
  request('/api/contacts', { method: 'POST', body: values }).then((r) => r.contact);

export const updateContact = (id, values) =>
  request(`/api/contacts/${id}`, { method: 'PATCH', body: values }).then((r) => r.contact);

export const deleteContact = (id) =>
  request(`/api/contacts/${id}`, { method: 'DELETE' }).then((r) => r.contact);
