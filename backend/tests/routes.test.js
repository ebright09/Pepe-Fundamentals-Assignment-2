import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ApiError } from '../src/errors.js';

/**
 * End-to-end route behaviour with the network stubbed out: a fake
 * authenticator stands in for JWKS verification, and a fake Data API stands in
 * for Postgres. This proves the HTTP contract — status codes, error shapes,
 * and that user_id is never forwarded to the database.
 */

const config = {
  allowedOrigins: ['http://localhost:5173'],
  dataApiUrl: 'https://example.invalid/rest/v1',
  jwksUrl: 'https://example.invalid/auth/jwks',
};

/** Accepts any Bearer token; rejects a request without one, as the real one does. */
const fakeAuth = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('You must be signed in to do that.'));
  }
  req.accessToken = header.slice('Bearer '.length);
  req.userId = 'user-a';
  next();
};

let dataApi;
let app;

beforeEach(() => {
  dataApi = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(async (_token, values) => ({
      id: '11111111-2222-3333-4444-555555555555',
      user_id: 'user-a',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
      ...values,
    })),
    update: vi.fn().mockImplementation(async (_token, id, values) => ({ id, ...values })),
    remove: vi.fn().mockResolvedValue({ id: '11111111-2222-3333-4444-555555555555' }),
  };
  app = createApp({ config, dataApi, authenticate: fakeAuth });
});

const auth = (req) => req.set('Authorization', 'Bearer test-token');

describe('authentication', () => {
  it('rejects an unauthenticated list request with 401', async () => {
    const res = await request(app).get('/api/contacts');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/signed in/i);
    expect(dataApi.list).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated create with 401 and never writes', async () => {
    const res = await request(app).post('/api/contacts').send({ name: 'Sneaky' });
    expect(res.status).toBe(401);
    expect(dataApi.create).not.toHaveBeenCalled();
  });

  it('allows an authenticated request through', async () => {
    const res = await auth(request(app).get('/api/contacts'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ contacts: [] });
  });

  it('forwards the caller\'s own token to the data layer, so RLS applies', async () => {
    await auth(request(app).get('/api/contacts'));
    expect(dataApi.list).toHaveBeenCalledWith('test-token', expect.any(Object));
  });
});

describe('POST /api/contacts', () => {
  it('creates a valid contact and returns 201', async () => {
    const res = await auth(request(app).post('/api/contacts')).send({
      name: 'Priya Raman',
      company: 'Berkeley Lab',
      priority: 'high',
    });
    expect(res.status).toBe(201);
    expect(res.body.contact.name).toBe('Priya Raman');
  });

  it('rejects an empty name with 400 and a field-level message', async () => {
    const res = await auth(request(app).post('/api/contacts')).send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Name is required.');
    expect(res.body.fields).toEqual({ name: 'Name is required.' });
    expect(dataApi.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid priority with 400 and a field-level message', async () => {
    const res = await auth(request(app).post('/api/contacts')).send({
      name: 'Valid Name',
      priority: 'urgent',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Priority must be one of: high, medium, low.');
    expect(res.body.fields.priority).toBeDefined();
    expect(dataApi.create).not.toHaveBeenCalled();
  });

  it('never forwards a client-supplied user_id to the database', async () => {
    const res = await auth(request(app).post('/api/contacts')).send({
      name: 'Impersonation Attempt',
      user_id: 'user-b',
    });
    expect(res.status).toBe(400);
    expect(dataApi.create).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/contacts/:id', () => {
  const id = '11111111-2222-3333-4444-555555555555';

  it('updates an owned contact', async () => {
    const res = await auth(request(app).patch(`/api/contacts/${id}`)).send({ priority: 'low' });
    expect(res.status).toBe(200);
    expect(dataApi.update).toHaveBeenCalledWith('test-token', id, { priority: 'low' });
  });

  it('rejects a malformed id with 400', async () => {
    const res = await auth(request(app).patch('/api/contacts/not-a-uuid')).send({ priority: 'low' });
    expect(res.status).toBe(400);
    expect(dataApi.update).not.toHaveBeenCalled();
  });

  it('rejects an empty update body with 400', async () => {
    const res = await auth(request(app).patch(`/api/contacts/${id}`)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Provide at least one field to update.');
  });

  it("returns 404 when the row is not the caller's — RLS matched nothing", async () => {
    dataApi.update.mockRejectedValueOnce(ApiError.notFound());
    const res = await auth(request(app).patch(`/api/contacts/${id}`)).send({ priority: 'low' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/does not exist, or is not yours/i);
  });
});

describe('DELETE /api/contacts/:id', () => {
  const id = '11111111-2222-3333-4444-555555555555';

  it('deletes an owned contact', async () => {
    const res = await auth(request(app).delete(`/api/contacts/${id}`));
    expect(res.status).toBe(200);
    expect(dataApi.remove).toHaveBeenCalledWith('test-token', id);
  });

  it("returns 404 for another user's contact", async () => {
    dataApi.remove.mockRejectedValueOnce(ApiError.notFound());
    const res = await auth(request(app).delete(`/api/contacts/${id}`));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/contacts — sorting and filtering', () => {
  it('passes validated sort and filter options through', async () => {
    await auth(request(app).get('/api/contacts?sort=name&order=asc&priority=high&q=berkeley'));
    expect(dataApi.list).toHaveBeenCalledWith('test-token', {
      sort: 'name',
      order: 'asc',
      priority: 'high',
      q: 'berkeley',
    });
  });

  it('rejects an unknown sort column with 400', async () => {
    const res = await auth(request(app).get('/api/contacts?sort=user_id'));
    expect(res.status).toBe(400);
    expect(dataApi.list).not.toHaveBeenCalled();
  });
});

describe('error handling', () => {
  it('serves an unauthenticated health check', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 404 for an unknown endpoint', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
  });

  it('does not leak internal detail when something unexpected throws', async () => {
    dataApi.list.mockRejectedValueOnce(new Error('connection string postgres://secret@host/db'));
    const res = await auth(request(app).get('/api/contacts'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/postgres:\/\//);
    expect(res.body.error).toMatch(/something went wrong/i);
  });
});
