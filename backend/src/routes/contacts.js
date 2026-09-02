import { Router } from 'express';
import {
  createContactSchema,
  updateContactSchema,
  listQuerySchema,
  uuidSchema,
  parseOrThrow,
} from '../validation.js';

/**
 * Contact routes. Each handler validates first, then delegates to the Data API
 * using the caller's token. No handler ever adds a `user_id` filter of its
 * own — ownership is enforced by RLS in Postgres, which is the only place it
 * can be enforced reliably.
 */
export const contactsRouter = (dataApi) => {
  const router = Router();

  const wrap = (handler) => (req, res, next) => handler(req, res, next).catch(next);

  // GET /api/contacts?sort=name&order=asc&priority=high&q=berkeley
  router.get(
    '/',
    wrap(async (req, res) => {
      const query = parseOrThrow(listQuerySchema, req.query);
      const contacts = await dataApi.list(req.accessToken, query);
      res.json({ contacts: contacts ?? [] });
    })
  );

  // POST /api/contacts
  router.post(
    '/',
    wrap(async (req, res) => {
      const values = parseOrThrow(createContactSchema, req.body ?? {});
      const contact = await dataApi.create(req.accessToken, values);
      res.status(201).json({ contact });
    })
  );

  // PATCH /api/contacts/:id
  router.patch(
    '/:id',
    wrap(async (req, res) => {
      const id = parseOrThrow(uuidSchema, req.params.id);
      const values = parseOrThrow(updateContactSchema, req.body ?? {});
      const contact = await dataApi.update(req.accessToken, id, values);
      res.json({ contact });
    })
  );

  // DELETE /api/contacts/:id
  router.delete(
    '/:id',
    wrap(async (req, res) => {
      const id = parseOrThrow(uuidSchema, req.params.id);
      const contact = await dataApi.remove(req.accessToken, id);
      res.json({ contact });
    })
  );

  return router;
};
