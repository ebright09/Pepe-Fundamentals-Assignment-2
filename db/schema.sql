-- ===========================================================================
--  Secure Networking Tracker — schema, constraints and Row Level Security
--  ---------------------------------------------------------------------
--  Apply this by pasting it into the Neon Console SQL Editor
--  (Project -> SQL Editor), or with:  npm run db:migrate  (needs DATABASE_URL)
--
--  This file is idempotent: it is safe to run more than once.
-- ===========================================================================

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. The contacts table
--
--    user_id is TEXT and defaults to auth.user_id(), which the Neon Data API
--    resolves from the `sub` claim of the caller's JWT. The application never
--    supplies user_id itself, so a row is always stamped with the identity of
--    whoever actually made the request. It is NOT NULL, so a row can never
--    exist without an owner.
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null default (auth.user_id()),

  name        text        not null
                          constraint contacts_name_not_blank
                          check (length(btrim(name)) between 1 and 120),

  company     text        constraint contacts_company_len check (length(company) <= 120),
  role        text        constraint contacts_role_len    check (length(role) <= 120),
  met_at      text        constraint contacts_met_at_len  check (length(met_at) <= 160),
  notes       text        constraint contacts_notes_len   check (length(notes) <= 2000),

  -- Priority is constrained in the database itself, so an invalid value is
  -- rejected even if it somehow gets past the API's validation layer.
  priority    text        not null default 'medium'
                          constraint contacts_priority_valid
                          check (priority in ('high', 'medium', 'low')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.contacts.user_id is
  'Owner. Defaults to auth.user_id() (the JWT sub claim). Never set by the client.';
comment on column public.contacts.met_at is
  'Free text: where you met this person, e.g. "Sutardja Dai Hall career fair".';

create index if not exists contacts_user_created_idx
  on public.contacts (user_id, created_at desc);

-- Keep updated_at honest.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  -- Defence in depth: never let an UPDATE change a row's owner.
  new.user_id = old.user_id;
  return new;
end;
$$;

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Row Level Security
--
--    With RLS enabled and these four policies in place, Postgres itself —
--    not the application — decides which rows a request may touch. Even a
--    caller hitting the public Data API directly with a valid token for
--    user A can only ever see or modify user A's rows.
-- ---------------------------------------------------------------------------
alter table public.contacts enable row level security;

-- Also apply RLS to the table owner, so nothing silently bypasses it.
alter table public.contacts force row level security;

drop policy if exists contacts_select_own on public.contacts;
drop policy if exists contacts_insert_own on public.contacts;
drop policy if exists contacts_update_own on public.contacts;
drop policy if exists contacts_delete_own on public.contacts;

-- SELECT: you may read only rows you own.
create policy contacts_select_own
  on public.contacts
  for select
  to authenticated
  using ((select auth.user_id()) = user_id);

-- INSERT: you may only create rows owned by you. WITH CHECK is evaluated
-- against the row *after* defaults are applied, so an attacker who supplies
-- someone else's user_id in the request body is rejected here.
create policy contacts_insert_own
  on public.contacts
  for insert
  to authenticated
  with check ((select auth.user_id()) = user_id);

-- UPDATE: USING decides which rows you may target; WITH CHECK decides what
-- they may look like afterwards. Having both means you cannot edit someone
-- else's row, and you cannot re-assign one of your rows to another user.
create policy contacts_update_own
  on public.contacts
  for update
  to authenticated
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);

-- DELETE: you may delete only rows you own.
create policy contacts_delete_own
  on public.contacts
  for delete
  to authenticated
  using ((select auth.user_id()) = user_id);

-- ---------------------------------------------------------------------------
-- 3. Grants
--
--    `authenticated` is the role the Data API assumes for a request carrying
--    a valid JWT; `anonymous` is used for requests without one. Anonymous
--    callers are given no privileges on this table at all, so an unauthenticated
--    request fails before RLS is even consulted.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.contacts to authenticated;
revoke all on public.contacts from anonymous;

-- ===========================================================================
--  Verification queries — run these after applying, to prove the setup.
-- ===========================================================================
-- Expect rowsecurity = true:
--   select relname, relrowsecurity, relforcerowsecurity
--     from pg_class where relname = 'contacts';
--
-- Expect exactly four policies, one per command:
--   select policyname, cmd, qual, with_check
--     from pg_policies where tablename = 'contacts' order by cmd;
