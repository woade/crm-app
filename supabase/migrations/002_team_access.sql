-- ─────────────────────────────────────────────────────────────────────────
-- Team access: let a hired sales rep sign in with their own account and work
-- the owner's leads, with every edit stamped so you can see who touched what.
--
-- Run this whole file once in the Supabase SQL Editor.
-- Safe to re-run: every statement is guarded.
--
-- Why this is needed: every table currently says
--   using (auth.uid() = user_id)
-- so a second account sees zero rows. This adds a membership layer instead
-- of loosening that rule for everyone.
-- ─────────────────────────────────────────────────────────────────────────


-- 1. PROFILES ────────────────────────────────────────────────────────────
-- The owner needs to add a rep by email, but client code can't read
-- auth.users. This mirrors just the id + email into a readable table, kept
-- in sync by a trigger.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "Profiles readable by signed-in users" on profiles;
create policy "Profiles readable by signed-in users" on profiles
  for select using (auth.role() = 'authenticated');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill anyone who already signed up before this migration.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;


-- 2. TEAM MEMBERS ────────────────────────────────────────────────────────
-- One row per rep. owner_id is the account that owns the leads (you);
-- member_id is the rep. `initials` is what shows on the badge, e.g. 'B'.

-- member_id points at profiles rather than auth.users on purpose: profiles.id
-- is itself a cascading FK to auth.users, so deletion still propagates, and
-- having the foreign key land on a readable table is what lets the app fetch
-- "team member + their email" in a single query.
create table if not exists team_members (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid not null references profiles (id) on delete cascade,
  display_name text,
  initials text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, member_id)
);

alter table team_members enable row level security;

-- The owner can add, edit and remove their reps. Removing the row is how you
-- revoke access: the rep keeps their login but stops seeing your leads.
drop policy if exists "Owner manages their team" on team_members;
create policy "Owner manages their team" on team_members
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- A rep can read their own membership row, which is how the app discovers
-- whose leads to load and which initials to stamp.
drop policy if exists "Member reads own membership" on team_members;
create policy "Member reads own membership" on team_members
  for select using (auth.uid() = member_id);


-- 3. MEMBERSHIP CHECK ────────────────────────────────────────────────────
-- security definer so the leads policy below can consult team_members
-- without recursing back through team_members' own row-level rules.

create or replace function public.is_team_member(owner uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from team_members tm
    where tm.owner_id = owner
      and tm.member_id = auth.uid()
  );
$$;


-- 4. LEADS: ATTRIBUTION COLUMNS ──────────────────────────────────────────
-- Denormalised initials so the list can render the badge without a join.

alter table leads add column if not exists last_edited_by uuid references auth.users (id);
alter table leads add column if not exists last_edited_initials text;
alter table leads add column if not exists last_edited_at timestamptz;


-- 5. LEADS: SHARED ACCESS ────────────────────────────────────────────────
-- Replaces the owner-only rule. Existing leads need no backfill: they stay
-- owned by you, and the rep reaches them through the membership check.
--
-- Deliberately split by command rather than one blanket "for all": a rep's
-- job is to call leads, move them through the pipeline and write notes. They
-- get SELECT and UPDATE. No INSERT, no DELETE. So there is no way for a rep
-- to create a stray lead or remove one, by accident or otherwise.

drop policy if exists "Leads are owned by the user" on leads;
drop policy if exists "Leads visible to owner and team" on leads;

drop policy if exists "Owner has full access to own leads" on leads;
create policy "Owner has full access to own leads" on leads
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Team can read owner leads" on leads;
create policy "Team can read owner leads" on leads
  for select using (public.is_team_member(user_id));

drop policy if exists "Team can update owner leads" on leads;
create policy "Team can update owner leads" on leads
  for update
  using (public.is_team_member(user_id))
  with check (public.is_team_member(user_id));


-- 6. LEADS: LOCK THE BUSINESS FACTS ──────────────────────────────────────
-- UPDATE permission in Postgres is all-or-nothing per row, so without this a
-- rep could rename a business or blank its phone number. This pins every
-- column that describes the business itself back to its previous value for
-- non-owners, leaving only the pipeline fields writable: status, notes,
-- availability, call log, contact person, and the edit stamp.
--
-- It silently preserves rather than raising an error, so a rep's legitimate
-- edit in the same save still goes through instead of failing confusingly.

create or replace function public.guard_lead_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The owner of the row can change anything.
  if auth.uid() = old.user_id then
    return new;
  end if;

  new.user_id    := old.user_id;
  new.place_id   := old.place_id;
  new.name       := old.name;
  new.industry   := old.industry;
  new.city       := old.city;
  new.address    := old.address;
  new.phone      := old.phone;
  new.website    := old.website;
  new.rating     := old.rating;
  new.reviews    := old.reviews;
  new.types      := old.types;
  new.created_at := old.created_at;

  return new;
end;
$$;

drop trigger if exists leads_guard_columns on leads;
create trigger leads_guard_columns
  before update on leads
  for each row execute function public.guard_lead_columns();


-- ─────────────────────────────────────────────────────────────────────────
-- AFTER RUNNING THIS:
--   1. Have the rep open the CRM and sign up with their own email/password.
--   2. In the app, go to Settings -> Team, enter their email and initials.
--   3. They sign out and back in; your leads appear, and their edits show
--      their badge.
--
-- TO REVOKE ACCESS LATER: remove them in Settings -> Team. Their login keeps
-- working but your leads disappear for them immediately.
-- ─────────────────────────────────────────────────────────────────────────
