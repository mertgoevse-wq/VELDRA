-- VELDRA backend: server-side entitlement source of truth.
--
-- Not deployed by this commit -- see docs/architecture/ENTITLEMENT_AND_SECURITY.md §3.5 for the
-- comparison that selected Supabase, the deployment steps, and why this is deliberately not
-- wired into the live app yet (no sign-in flow exists to produce a user JWT).
--
-- One row per Supabase Auth user. RLS makes "a user can only ever read their own row" a database
-- guarantee, not just an assumption the Edge Function's own code has to get right every time.

create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'FREE' check (tier in ('FREE', 'PREMIUM', 'PRO', 'DEVELOPER')),
  expires_at timestamptz,
  capabilities text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

-- A user may read only their own entitlement row.
create policy "entitlements_select_own"
  on public.entitlements
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy is defined for the authenticated role at all -- by omission,
-- ordinary users cannot grant or modify their own entitlement through the API, intentionally.
-- Only the service_role key (server-side only, e.g. a future Play Billing webhook) bypasses RLS
-- and may write this table. This is the enforcement point for "a copied APK alone cannot unlock
-- premium server capabilities" (§2.5) -- there is no client-reachable write path to bypass.

create index if not exists entitlements_expires_at_idx on public.entitlements (expires_at);
