-- First Rec. website V2 data contract (U7). Design: docs/V2-DATA-CONTRACT.md
--
-- STATUS: proposal. The platform (self-hosted Supabase, ADR-0001 D1) is not
-- approved yet. Never run this against a production database before founder
-- sign-off; it has only been exercised against throwaway local clusters by
-- tests/v2-schema.test.mjs.
--
-- Target: PostgreSQL 15+ (security_invoker views, CREATE OR REPLACE TRIGGER).
-- Idempotent: safe to apply repeatedly; nothing here drops tables or data.
--
-- Supabase-specific pieces (all marked "SUPABASE:"):
--   * roles anon / authenticated / service_role (created here only if missing)
--   * auth.uid() (a compatible shim is created only if missing)
--   * FK admin_users.user_id -> auth.users(id) (added only if auth.users exists)
--   * Storage buckets/policies are NOT created here (see contract §7).

begin;

-- ---------------------------------------------------------------------------
-- 0. Roles and auth shim
-- ---------------------------------------------------------------------------

-- SUPABASE: these roles already exist there. Plain Postgres needs them for RLS.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

create schema if not exists auth;

-- SUPABASE: auth.uid() is provided by GoTrue's schema. This shim reads the
-- same request.jwt.claim(s) settings PostgREST sets, and is only created when
-- the function is missing, so a real Supabase install keeps its own.
do $$
begin
  if to_regprocedure('auth.uid()') is null then
    execute $f$
      create function auth.uid() returns uuid
      language sql stable
      as $body$
        select nullif(coalesce(
          current_setting('request.jwt.claim.sub', true),
          current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
        ), '')::uuid
      $body$
    $f$;
  end if;
end $$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Enums (CREATE TYPE has no IF NOT EXISTS; extend later with
--    ALTER TYPE ... ADD VALUE IF NOT EXISTS)
-- ---------------------------------------------------------------------------

do $$
begin
  create type admin_role as enum ('owner', 'editor');
exception when duplicate_object then null; end $$;

do $$
begin
  create type publication_status as enum ('internal', 'in_review', 'approved', 'published', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$
begin
  -- Labels match CaseStudy["discipline"] in app/_data/site.ts exactly.
  create type project_discipline as enum ('Film + production', 'Photography', 'Food + menu', 'Food + hospitality');
exception when duplicate_object then null; end $$;

do $$
begin
  create type layout_mode as enum ('legacy_template', 'blocks');
exception when duplicate_object then null; end $$;

do $$
begin
  create type clearance_kind as enum (
    'public_display', 'client_name', 'talent_release', 'minor_release',
    'product_claims', 'music', 'location', 'credits'
  );
exception when duplicate_object then null; end $$;

do $$
begin
  create type clearance_status as enum ('unverified_claim', 'requested', 'verified', 'denied', 'revoked');
exception when duplicate_object then null; end $$;

do $$
begin
  create type fact_state as enum ('known', 'unknown', 'withheld');
exception when duplicate_object then null; end $$;

do $$
begin
  create type asset_class as enum ('original', 'derivative');
exception when duplicate_object then null; end $$;

do $$
begin
  create type media_kind as enum ('image', 'video');
exception when duplicate_object then null; end $$;

do $$
begin
  create type media_variant as enum ('source', '2400', '1600', '1200', '800', 'thumbnail', 'web_video', 'legacy');
exception when duplicate_object then null; end $$;

do $$
begin
  create type media_usage as enum ('hero', 'gallery', 'film', 'block');
exception when duplicate_object then null; end $$;

do $$
begin
  create type block_type as enum (
    'hero', 'intro', 'facts', 'gallery', 'video', 'fullImage',
    'twoColumn', 'deliverables', 'credits', 'bts', 'next'
  );
exception when duplicate_object then null; end $$;

do $$
begin
  create type inquiry_status as enum ('NEW', 'IN_PROGRESS', 'REPLIED', 'WON', 'LOST', 'SPAM', 'ARCHIVED');
exception when duplicate_object then null; end $$;

do $$
begin
  create type inquiry_source as enum ('website_form', 'manual');
exception when duplicate_object then null; end $$;

do $$
begin
  create type preview_access as enum ('VIEW_ONLY', 'DOWNLOAD_DERIVATIVES');
exception when duplicate_object then null; end $$;

do $$
begin
  create type preview_outcome as enum ('granted', 'expired', 'revoked');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

create table if not exists admin_users (
  user_id      uuid primary key,             -- SUPABASE: = auth.users.id
  email        text not null unique check (email = lower(email) and length(email) between 3 and 320),
  display_name text,
  role         admin_role not null default 'editor',
  active       boolean not null default true,
  invited_by   uuid references admin_users (user_id),
  created_at   timestamptz not null default now()
);

-- SUPABASE: tie admins to real auth users when GoTrue's table exists.
do $$
begin
  if to_regclass('auth.users') is not null
     and not exists (select 1 from pg_constraint where conname = 'admin_users_user_id_auth_fk') then
    alter table admin_users
      add constraint admin_users_user_id_auth_fk foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end $$;

create table if not exists projects (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  client_name         text not null check (btrim(client_name) <> ''),
  category            text not null,
  discipline          project_discipline not null,
  scope               text,
  summary             text,
  challenge           text,
  response            text,
  outcome             text,
  hero_caption        text,                      -- public caption; NOT the legacy mediaNotice
  layout              layout_mode not null default 'legacy_template',
  sort_order          integer not null default 0,
  project_date        date,
  publication_status  publication_status not null default 'internal',
  published_at        timestamptz,
  withdrawn_at        timestamptz,
  legacy_media_notice text,                      -- internal note only, never parsed as approval
  internal_notes      text,
  version             integer not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid,
  constraint projects_published_has_date check (publication_status <> 'published' or published_at is not null)
);

create table if not exists rights_clearances (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects (id) on delete cascade,
  kind              clearance_kind not null,
  status            clearance_status not null default 'unverified_claim',
  source            text not null check (btrim(source) <> ''),   -- where the claim/approval came from
  granted_by        text,                                        -- person / organisation who approved
  granted_on        date,
  scope             text,                                        -- what exactly was approved
  evidence_location text,                                        -- email id, contract path, doc path
  expires_on        date,
  notes             text,
  recorded_by       uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- A verified clearance must say who approved it, when, and where the proof lives.
  constraint rights_verified_needs_evidence check (
    status <> 'verified'
    or (granted_by is not null and granted_on is not null and nullif(btrim(evidence_location), '') is not null)
  ),
  constraint rights_expiry_after_grant check (expires_on is null or granted_on is null or expires_on >= granted_on),
  constraint rights_project_kind_source unique (project_id, kind, source)
);

create table if not exists project_facts (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  label       text not null check (btrim(label) <> ''),
  value       text,
  state       fact_state not null,
  sort_order  integer not null default 0,
  source      text,                                    -- e.g. 'site.ts:channels'
  -- "known" means renderable, as known() in app/_components/CaseStudyBlocks.tsx decides: not blank
  -- and not a placeholder (same list) once trimmed. The bracket class is exactly the whitespace JS
  -- trim() strips; btrim() only strips spaces and \s follows the server locale (ASCII-only under C,
  -- missing NBSP, U+3000 and the BOM). The three adjacent literals are one pattern.
  constraint facts_known_is_renderable check (
    (state = 'known'
      and value is not null
      and value !~* '^[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*'
                    '(tbc|tbd|n/a|na|unknown|pending|-|\?)?'
                    '[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*$')
    or (state <> 'known' and value is null)
  ),
  constraint facts_project_label unique (project_id, label)
);

create table if not exists project_credits (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  role        text not null check (btrim(role) <> ''),
  name        text,
  state       fact_state not null,
  sort_order  integer not null default 0,
  -- Same renderable test as project_facts.value.
  constraint credits_known_has_name check (
    (state = 'known'
      and name is not null
      and name !~* '^[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*'
                   '(tbc|tbd|n/a|na|unknown|pending|-|\?)?'
                   '[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*$')
    or (state <> 'known' and name is null)
  ),
  constraint credits_project_order unique (project_id, sort_order)
);

create table if not exists media_assets (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid references projects (id) on delete set null,
  class            asset_class not null,
  kind             media_kind not null,
  variant          media_variant not null,
  derived_from     uuid references media_assets (id) on delete set null,
  -- Derivatives: logical web path, e.g. 'portfolio/geely/hero.jpg' (served from
  -- dist/client when public, private bucket when not).
  path             text unique,
  storage_bucket   text,                       -- SUPABASE: private bucket name for non-public derivatives
  -- Originals: internal pointer only (NAS / Drive). Never a web path.
  source_reference text,
  mime_type        text,
  width            integer check (width > 0),
  height           integer check (height > 0),
  duration_seconds numeric check (duration_seconds > 0),
  bytes            bigint check (bytes > 0),
  checksum_sha256  text check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  created_at       timestamptz not null default now(),
  constraint media_class_storage check (
    (class = 'derivative' and path is not null and source_reference is null and variant <> 'source')
    or (class = 'original' and path is null and storage_bucket is null and source_reference is not null and variant = 'source')
  ),
  constraint media_path_shape check (path is null or (path !~ '^/' and path !~ '\.\.' and path ~ '^portfolio/'))
);

create table if not exists content_blocks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  position    integer not null check (position >= 0),
  type        block_type not null,
  props       jsonb not null default '{}'::jsonb,
  constraint blocks_props_object check (jsonb_typeof(props) = 'object'),
  -- Facts/credits items live in project_facts / project_credits, not in props.
  constraint blocks_no_inline_facts check (type not in ('facts', 'credits') or not (props ? 'items')),
  -- Media lives in project_media (usage = 'block'), not in props.
  constraint blocks_no_inline_media check (not (props ?| array['image', 'images', 'films', 'src', 'poster'])),
  constraint blocks_next_has_slug check (type <> 'next' or coalesce(jsonb_typeof(props -> 'slug') = 'string', false)),
  constraint blocks_project_position unique (project_id, position)
);

create table if not exists project_media (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  media_id    uuid not null references media_assets (id) on delete restrict,
  usage       media_usage not null,
  block_id    uuid references content_blocks (id) on delete cascade,
  position    integer not null default 0 check (position >= 0),
  alt         text,
  title       text,
  caption     text,
  aspect_ratio text check (aspect_ratio ~ '^[0-9]+(\.[0-9]+)? / [0-9]+(\.[0-9]+)?$'),
  poster_id   uuid references media_assets (id) on delete restrict,
  constraint project_media_block_usage check ((usage = 'block') = (block_id is not null)),
  constraint project_media_poster_only_film check (poster_id is null or usage in ('film', 'block')),
  constraint project_media_slot unique nulls not distinct (project_id, usage, block_id, position)
);

create table if not exists collections (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title       text not null,
  description text,
  is_featured_list boolean not null default false,  -- home page selection
  provisional boolean not null default false,       -- DECISIONS.md 2026-10-31: placeholder selection
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists collection_projects (
  collection_id uuid not null references collections (id) on delete cascade,
  project_id    uuid not null references projects (id) on delete cascade,
  position      integer not null default 0,
  primary key (collection_id, project_id)
);

create table if not exists inquiries (
  id          uuid primary key default gen_random_uuid(),
  -- anon can insert directly, so the caps apply to the raw value (padding counts). "Not blank" uses
  -- the project_facts whitespace class: some character must be outside it.
  name        text not null check (length(name) <= 200
                                   and name ~ '[^\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]'),
  email       text not null check (length(email) <= 320 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message     text not null check (length(message) <= 5000
                                   and message ~ '[^\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]'),
  status      inquiry_status not null default 'NEW',
  source      inquiry_source not null default 'website_form',
  dedupe_key  text unique check (dedupe_key is null or length(dedupe_key) between 16 and 128),
  assigned_to uuid references admin_users (user_id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists inquiry_events (
  id          bigint generated always as identity primary key,
  inquiry_id  uuid not null references inquiries (id) on delete cascade,
  kind        text not null check (kind in ('status_change', 'note', 'reply_sent')),
  from_status inquiry_status,
  to_status   inquiry_status,
  note        text,
  actor       uuid,
  created_at  timestamptz not null default now(),
  constraint inquiry_events_status_pair check (kind <> 'status_change' or to_status is not null)
);

create table if not exists inquiry_reply_drafts (
  id          uuid primary key default gen_random_uuid(),
  inquiry_id  uuid not null references inquiries (id) on delete cascade,
  body        text not null,
  generated_by text not null check (generated_by in ('ai', 'human')),
  model_note  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  sent_by     uuid references admin_users (user_id),
  -- AI never sends: a sent draft always names the human who sent it.
  constraint drafts_sent_by_human check (sent_at is null or sent_by is not null)
);

create table if not exists preview_links (
  id          uuid primary key default gen_random_uuid(),
  token_hash  bytea not null unique check (length(token_hash) = 32),  -- sha256 of the token; plaintext never stored
  label       text,
  access      preview_access not null default 'VIEW_ONLY',
  created_by  uuid,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  revoked_at  timestamptz,
  revoked_by  uuid,
  constraint preview_expiry_after_create check (expires_at > created_at),
  constraint preview_revoke_after_create check (revoked_at is null or revoked_at >= created_at)
);

create table if not exists preview_link_projects (
  preview_link_id uuid not null references preview_links (id) on delete cascade,
  project_id      uuid not null references projects (id) on delete cascade,
  primary key (preview_link_id, project_id)
);

create table if not exists preview_views (
  id              bigint generated always as identity primary key,
  preview_link_id uuid not null references preview_links (id) on delete cascade,
  viewed_at       timestamptz not null default now(),
  project_id      uuid references projects (id) on delete set null,
  outcome         preview_outcome not null
  -- No IP / user agent columns until the privacy policy (ADR Q9) is decided.
);

create table if not exists audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid,                 -- auth.uid() at the time, null for service/migration
  db_role    text not null,        -- anon / authenticated / service_role / postgres
  action     text not null,        -- INSERT / UPDATE / DELETE
  table_name text not null,
  row_id     text,
  before     jsonb,
  after      jsonb
);

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

create index if not exists projects_status_idx on projects (publication_status, sort_order);
create index if not exists rights_project_idx on rights_clearances (project_id, kind, status);
create index if not exists facts_project_idx on project_facts (project_id, sort_order);
create index if not exists credits_project_idx on project_credits (project_id, sort_order);
create index if not exists media_project_idx on media_assets (project_id);
create index if not exists media_derived_from_idx on media_assets (derived_from);
create index if not exists project_media_project_idx on project_media (project_id, usage, position);
create index if not exists project_media_media_idx on project_media (media_id);
create index if not exists collection_projects_project_idx on collection_projects (project_id);
create index if not exists inquiries_status_idx on inquiries (status, created_at desc);
create index if not exists inquiry_events_inquiry_idx on inquiry_events (inquiry_id, created_at);
create index if not exists drafts_inquiry_idx on inquiry_reply_drafts (inquiry_id);
create index if not exists preview_links_active_idx on preview_links (expires_at) where revoked_at is null;
create index if not exists preview_link_projects_project_idx on preview_link_projects (project_id);
create index if not exists preview_views_link_idx on preview_views (preview_link_id, viewed_at);
create index if not exists audit_log_row_idx on audit_log (table_name, row_id);
create index if not exists audit_log_at_idx on audit_log (at);

-- ---------------------------------------------------------------------------
-- 4. Helper functions (SECURITY DEFINER so RLS policies can read admin_users)
-- ---------------------------------------------------------------------------

create or replace function current_admin_role() returns admin_role
language sql stable security definer set search_path = public, pg_temp
as $$
  select role from admin_users where user_id = auth.uid() and active
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select current_admin_role() is not null $$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$ select current_admin_role() = 'owner' $$;

-- True when the project has a verified, unexpired public-display clearance.
create or replace function has_public_clearance(p_project uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from rights_clearances
    where project_id = p_project
      and kind = 'public_display'
      and status = 'verified'
      and (expires_on is null or expires_on >= current_date)
  )
$$;

-- Published AND still cleared, so an expired clearance hides a project at read
-- time even before anyone withdraws it.
create or replace function is_public_project(p_project uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from projects where id = p_project and publication_status = 'published')
     and has_public_clearance(p_project)
$$;

-- ---------------------------------------------------------------------------
-- 5. Triggers: publication guard, timestamps, audit
-- ---------------------------------------------------------------------------

create or replace function projects_guard() returns trigger
language plpgsql set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;

  if new.publication_status in ('approved', 'published') then
    if tg_op = 'INSERT' or not has_public_clearance(new.id) then
      raise exception 'project % cannot be % without a verified public_display clearance', new.slug, new.publication_status
        using errcode = 'check_violation';
    end if;
  end if;

  if new.publication_status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  if new.publication_status = 'withdrawn' and (tg_op = 'INSERT' or old.publication_status <> 'withdrawn') then
    new.withdrawn_at := now();
  end if;

  -- Editors may move drafts between internal and in_review only.
  if current_user = 'authenticated' and not is_owner() then
    if (tg_op = 'INSERT' and new.publication_status not in ('internal', 'in_review'))
       or (tg_op = 'UPDATE' and new.publication_status is distinct from old.publication_status
           and (new.publication_status not in ('internal', 'in_review')
                or old.publication_status not in ('internal', 'in_review'))) then
      raise exception 'only an owner can approve, publish or withdraw a project' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;

create or replace trigger projects_guard
  before insert or update on projects
  for each row execute function projects_guard();

create or replace function touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- Losing the clearance of a published/approved project withdraws it.
create or replace function rights_withdraw_if_uncleared() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_project uuid := coalesce(new.project_id, old.project_id);
begin
  if not has_public_clearance(v_project) then
    update projects set publication_status = 'withdrawn'
      where id = v_project and publication_status in ('approved', 'published');
  end if;
  return null;
end $$;

create or replace trigger rights_touch
  before update on rights_clearances
  for each row execute function touch_updated_at();

create or replace trigger rights_withdraw
  after update or delete on rights_clearances
  for each row execute function rights_withdraw_if_uncleared();

create or replace trigger inquiries_touch
  before update on inquiries
  for each row execute function touch_updated_at();

-- Generic audit. TG_ARGV[0] = 'no_payload' keeps personal data (inquiries)
-- out of the audit log; only the row id and action are recorded.
create or replace function audit_row() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_role text := coalesce(nullif(current_setting('role', true), 'none'), session_user);
begin
  if tg_argv[0] = 'no_payload' then
    v_old := null;
    v_new := null;
  end if;
  insert into audit_log (actor, db_role, action, table_name, row_id, before, after)
  values (
    auth.uid(), v_role, tg_op, tg_table_name,
    coalesce(v_new, v_old, to_jsonb(coalesce(new, old))) ->> 'id',
    v_old - 'token_hash', v_new - 'token_hash'
  );
  return null;
end $$;

create or replace function audit_log_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only' using errcode = 'insufficient_privilege';
end $$;

create or replace trigger audit_log_no_update
  before update or delete on audit_log
  for each row execute function audit_log_append_only();

create or replace trigger audit_log_no_truncate
  before truncate on audit_log
  for each statement execute function audit_log_append_only();

do $$
declare
  t text;
begin
  foreach t in array array[
    'admin_users', 'projects', 'rights_clearances', 'project_facts', 'project_credits',
    'media_assets', 'project_media', 'content_blocks', 'collections', 'collection_projects',
    'preview_links', 'preview_link_projects'
  ] loop
    execute format(
      'create or replace trigger %I after insert or update or delete on %I for each row execute function audit_row()',
      t || '_audit', t);
  end loop;
  foreach t in array array['inquiries', 'inquiry_reply_drafts'] loop
    execute format(
      'create or replace trigger %I after insert or update or delete on %I for each row execute function audit_row(%L)',
      t || '_audit', t, 'no_payload');
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Private preview functions
-- ---------------------------------------------------------------------------

-- Creates a link and returns the plaintext token exactly once. SECURITY
-- INVOKER: RLS on preview_links decides who may call it (owner / service_role).
-- 244 random bits from two gen_random_uuid() calls (pg_strong_random), so no
-- pgcrypto dependency.
create or replace function create_preview_link(
  p_project_ids uuid[],
  p_label text default null,
  p_ttl interval default interval '7 days',
  p_access preview_access default 'VIEW_ONLY'
) returns table (link_id uuid, token text, expires_at timestamptz)
language plpgsql volatile set search_path = public, pg_temp
as $$
declare
  v_token text := translate(encode(decode(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'),
    '+/=', '-_');
  v_id uuid;
  v_expires timestamptz;
begin
  if p_project_ids is null or cardinality(p_project_ids) = 0 then
    raise exception 'a preview link needs at least one project';
  end if;
  insert into preview_links (token_hash, label, access, created_by, expires_at)
  values (sha256(convert_to(v_token, 'UTF8')), p_label, p_access, auth.uid(), now() + p_ttl)
  returning id, preview_links.expires_at into v_id, v_expires;
  insert into preview_link_projects (preview_link_id, project_id)
  select v_id, unnest(p_project_ids);
  return query select v_id, v_token, v_expires;
end $$;

-- Resolves a token for anonymous visitors. Returns nothing for unknown,
-- expired or revoked tokens; logs every attempt against a known link.
-- Payload: renderable content only (known facts/credits, derivative media).
create or replace function open_preview(p_token text)
returns table (project_id uuid, slug text, access preview_access, expires_at timestamptz, payload jsonb)
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  v_link preview_links%rowtype;
  v_outcome preview_outcome;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then
    return;
  end if;
  select * into v_link from preview_links where token_hash = sha256(convert_to(p_token, 'UTF8'));
  if not found then
    return;
  end if;

  v_outcome := case
    when v_link.revoked_at is not null then 'revoked'
    when v_link.expires_at <= now() then 'expired'
    else 'granted'
  end;
  insert into preview_views (preview_link_id, outcome) values (v_link.id, v_outcome);
  if v_outcome <> 'granted' then
    return;
  end if;

  return query
  select p.id, p.slug, v_link.access, v_link.expires_at,
    jsonb_build_object(
      'slug', p.slug, 'client', p.client_name, 'category', p.category, 'discipline', p.discipline,
      'scope', p.scope, 'summary', p.summary, 'challenge', p.challenge, 'response', p.response,
      'outcome', p.outcome, 'layout', p.layout,
      'facts', coalesce((select jsonb_agg(jsonb_build_object('label', f.label, 'value', f.value) order by f.sort_order)
                         from project_facts f where f.project_id = p.id and f.state = 'known'), '[]'),
      'credits', coalesce((select jsonb_agg(jsonb_build_object('role', c.role, 'name', c.name) order by c.sort_order)
                           from project_credits c where c.project_id = p.id and c.state = 'known'), '[]'),
      'blocks', coalesce((select jsonb_agg(jsonb_build_object('type', b.type) || b.props order by b.position)
                          from content_blocks b where b.project_id = p.id), '[]'),
      'media', coalesce((select jsonb_agg(jsonb_build_object(
                            'usage', pm.usage, 'position', pm.position, 'path', m.path, 'kind', m.kind,
                            'alt', pm.alt, 'title', pm.title, 'ratio', pm.aspect_ratio,
                            'poster', (select pp.path from media_assets pp where pp.id = pm.poster_id and pp.class = 'derivative'))
                          order by pm.usage, pm.position)
                         from project_media pm join media_assets m on m.id = pm.media_id
                         where pm.project_id = p.id and m.class = 'derivative'), '[]')
    )
  from preview_link_projects lp
  join projects p on p.id = lp.project_id
  where lp.preview_link_id = v_link.id
  order by p.sort_order;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Public read views (security_invoker: the caller's RLS still applies)
-- ---------------------------------------------------------------------------

create or replace view public_projects with (security_invoker = true) as
  select id, slug, client_name, category, discipline, scope, summary, challenge, response, outcome,
         hero_caption, layout, sort_order, project_date, published_at
  from projects where publication_status = 'published' and has_public_clearance(id);

create or replace view public_project_facts with (security_invoker = true) as
  select project_id, label, value, sort_order from project_facts where state = 'known';

create or replace view public_project_credits with (security_invoker = true) as
  select project_id, role, name, sort_order from project_credits where state = 'known';

-- `next` blocks pointing at a non-public project are dropped.
create or replace view public_content_blocks with (security_invoker = true) as
  select b.project_id, b.position, b.type, b.props
  from content_blocks b
  where b.type <> 'next'
     or exists (select 1 from public_projects n where n.slug = b.props ->> 'slug');

-- ---------------------------------------------------------------------------
-- 8. Privileges and Row Level Security
--
-- SUPABASE: default privileges grant ALL on new public tables to anon and
-- authenticated. Revoke everything first, then grant exactly what is needed.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function current_admin_role(), is_admin(), is_owner(), has_public_clearance(uuid), is_public_project(uuid)
  to anon, authenticated;
grant execute on function open_preview(text) to anon, authenticated;
grant execute on function create_preview_link(uuid[], text, interval, preview_access) to authenticated;

-- anon: public columns only, rows filtered by RLS below. publication_status is
-- readable so the security_invoker views can filter on it (anon only ever
-- sees 'published' rows).
grant select (id, slug, client_name, category, discipline, scope, summary, challenge, response, outcome,
              hero_caption, layout, sort_order, project_date, publication_status, published_at)
  on projects to anon;
grant select (project_id, label, value, state, sort_order) on project_facts to anon;
grant select (project_id, role, name, state, sort_order) on project_credits to anon;
grant select (id, project_id, class, kind, variant, path, mime_type, width, height, duration_seconds)
  on media_assets to anon;
grant select (project_id, media_id, usage, block_id, position, alt, title, caption, aspect_ratio, poster_id)
  on project_media to anon;
grant select (id, project_id, position, type, props) on content_blocks to anon;
grant select (id, slug, title, description, is_featured_list, is_public) on collections to anon;
grant select on collection_projects to anon;
grant select on public_projects, public_project_facts, public_project_credits, public_content_blocks to anon, authenticated;
-- anon may submit an inquiry (name/email/message/dedupe_key only) but never read one.
grant insert (name, email, message, dedupe_key) on inquiries to anon;

-- authenticated: table privileges are broad, RLS narrows them to active admins.
grant select, insert, update, delete on
  projects, rights_clearances, project_facts, project_credits, media_assets, project_media,
  content_blocks, collections, collection_projects, inquiries, inquiry_events, inquiry_reply_drafts,
  preview_links, preview_link_projects
  to authenticated;
grant select on admin_users, preview_views, audit_log to authenticated;
grant insert, update on admin_users to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'admin_users', 'projects', 'rights_clearances', 'project_facts', 'project_credits', 'media_assets',
    'project_media', 'content_blocks', 'collections', 'collection_projects', 'inquiries', 'inquiry_events',
    'inquiry_reply_drafts', 'preview_links', 'preview_link_projects', 'preview_views', 'audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- CREATE POLICY has no IF NOT EXISTS: drop-and-create keeps this idempotent.

-- projects
drop policy if exists projects_anon_read on projects;
create policy projects_anon_read on projects for select to anon
  using (publication_status = 'published' and has_public_clearance(id));
drop policy if exists projects_admin_read on projects;
create policy projects_admin_read on projects for select to authenticated using (is_admin());
drop policy if exists projects_admin_insert on projects;
create policy projects_admin_insert on projects for insert to authenticated with check (is_admin());
drop policy if exists projects_admin_update on projects;
create policy projects_admin_update on projects for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists projects_owner_delete on projects;
create policy projects_owner_delete on projects for delete to authenticated using (is_owner());

-- rights_clearances: admins read, owner writes. Never anon.
drop policy if exists rights_admin_read on rights_clearances;
create policy rights_admin_read on rights_clearances for select to authenticated using (is_admin());
drop policy if exists rights_owner_write on rights_clearances;
create policy rights_owner_write on rights_clearances for all to authenticated using (is_owner()) with check (is_owner());

-- project content children: anon sees rows of published projects (facts and
-- credits only when known); admins read/write everything.
drop policy if exists facts_anon_read on project_facts;
create policy facts_anon_read on project_facts for select to anon
  using (state = 'known' and is_public_project(project_id));
drop policy if exists credits_anon_read on project_credits;
create policy credits_anon_read on project_credits for select to anon
  using (state = 'known' and is_public_project(project_id));
drop policy if exists blocks_anon_read on content_blocks;
create policy blocks_anon_read on content_blocks for select to anon
  using (is_public_project(project_id));
drop policy if exists project_media_anon_read on project_media;
create policy project_media_anon_read on project_media for select to anon
  using (is_public_project(project_id));
-- A derivative is public only while a public project places it (as media or a film poster) and it
-- is not held in a private bucket: unplaced uploads such as rejected shots stay private even under a
-- published project. `media_assets.id` is qualified because project_media has an id of its own.
drop policy if exists media_anon_read on media_assets;
create policy media_anon_read on media_assets for select to anon
  using (class = 'derivative' and storage_bucket is null and is_public_project(project_id)
         and exists (select 1 from project_media pm
                     where media_assets.id in (pm.media_id, pm.poster_id) and is_public_project(pm.project_id)));
drop policy if exists collections_anon_read on collections;
create policy collections_anon_read on collections for select to anon using (is_public);
drop policy if exists collection_projects_anon_read on collection_projects;
create policy collection_projects_anon_read on collection_projects for select to anon
  using (is_public_project(project_id)
         and exists (select 1 from collections c where c.id = collection_id and c.is_public));

do $$
declare
  t text;
begin
  foreach t in array array[
    'project_facts', 'project_credits', 'content_blocks', 'project_media', 'media_assets',
    'collections', 'collection_projects'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_admin_all', t);
    execute format(
      'create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())',
      t || '_admin_all', t);
  end loop;
end $$;

-- inquiries: anon insert-only; owner reads and manages the CRM.
drop policy if exists inquiries_anon_insert on inquiries;
create policy inquiries_anon_insert on inquiries for insert to anon
  with check (status = 'NEW' and source = 'website_form' and assigned_to is null);
drop policy if exists inquiries_owner_all on inquiries;
create policy inquiries_owner_all on inquiries for all to authenticated using (is_owner()) with check (is_owner());
drop policy if exists inquiry_events_owner_all on inquiry_events;
create policy inquiry_events_owner_all on inquiry_events for all to authenticated using (is_owner()) with check (is_owner());
drop policy if exists drafts_owner_all on inquiry_reply_drafts;
create policy drafts_owner_all on inquiry_reply_drafts for all to authenticated using (is_owner()) with check (is_owner());

-- preview links: owner only. Anonymous access goes through open_preview().
drop policy if exists preview_links_owner_all on preview_links;
create policy preview_links_owner_all on preview_links for all to authenticated using (is_owner()) with check (is_owner());
drop policy if exists preview_link_projects_owner_all on preview_link_projects;
create policy preview_link_projects_owner_all on preview_link_projects for all to authenticated
  using (is_owner()) with check (is_owner());
drop policy if exists preview_views_owner_read on preview_views;
create policy preview_views_owner_read on preview_views for select to authenticated using (is_owner());

-- admin_users: everyone sees their own row; owner manages all.
drop policy if exists admin_users_self_read on admin_users;
create policy admin_users_self_read on admin_users for select to authenticated
  using (user_id = auth.uid() or is_owner());
drop policy if exists admin_users_owner_insert on admin_users;
create policy admin_users_owner_insert on admin_users for insert to authenticated with check (is_owner());
drop policy if exists admin_users_owner_update on admin_users;
create policy admin_users_owner_update on admin_users for update to authenticated using (is_owner()) with check (is_owner());

-- audit_log: owner reads; nobody writes except the audit trigger.
drop policy if exists audit_owner_read on audit_log;
create policy audit_owner_read on audit_log for select to authenticated using (is_owner());

commit;
