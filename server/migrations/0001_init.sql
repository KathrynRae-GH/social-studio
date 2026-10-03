-- Milestone 0 and 1: brands, people, Team list, audit log, installs, jobs.
-- Every brand-owned table carries brand_id so a sub-account can hold more
-- than one brand later. location_id / company_id are the platform API's
-- names for a sub-account and the agency.

CREATE TABLE brands (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  text NOT NULL,
  company_id   text NOT NULL,
  name         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
-- One brand per sub-account in v1. Drop this index when that changes.
CREATE UNIQUE INDEX brands_one_per_location ON brands (location_id);

CREATE TABLE users (
  id            text PRIMARY KEY,            -- the platform's user id
  company_id    text NOT NULL,
  name          text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  is_agency     boolean NOT NULL DEFAULT false,
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
  brand_id    uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id     text NOT NULL REFERENCES users(id),
  role        text NOT NULL CHECK (role IN ('owner', 'team')),
  added_by    text NOT NULL REFERENCES users(id),
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, user_id)
);

CREATE TABLE access_requests (
  brand_id      uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id       text NOT NULL REFERENCES users(id),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, user_id)
);

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  brand_id    uuid REFERENCES brands(id) ON DELETE SET NULL,
  user_id     text NOT NULL,
  user_name   text NOT NULL,
  action      text NOT NULL,
  detail      jsonb NOT NULL DEFAULT '{}',
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_brand ON audit_log (brand_id, at DESC);

-- OAuth tokens per install. Tokens are encrypted by the app (AES-256-GCM)
-- before they reach this table.
CREATE TABLE installs (
  resource_id        text PRIMARY KEY,       -- location_id, or company_id for an agency install
  user_type          text NOT NULL,          -- 'Location' or 'Company'
  company_id         text,
  location_id        text,
  access_token_enc   text NOT NULL,
  refresh_token_enc  text NOT NULL,
  expires_at         timestamptz NOT NULL,
  scope              text NOT NULL DEFAULT '',
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Background work for the worker. Claimed with FOR UPDATE SKIP LOCKED.
CREATE TABLE jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     uuid REFERENCES brands(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}',
  status       text NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts     int NOT NULL DEFAULT 0,
  result       jsonb,
  error        text,
  run_after    timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  finished_at  timestamptz
);
CREATE INDEX jobs_ready ON jobs (run_after) WHERE status = 'queued';

CREATE TABLE worker_heartbeats (
  worker_id  text PRIMARY KEY,
  beat_at    timestamptz NOT NULL DEFAULT now(),
  version    text NOT NULL DEFAULT ''
);
