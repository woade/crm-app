-- Run this once in the Supabase SQL editor for your project.
-- Creates the CRM tables and locks every row to its owning user via RLS.

create extension if not exists "uuid-ossp";

-- CONTACTS -------------------------------------------------------------
create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  full_name text not null,
  company text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

alter table contacts enable row level security;

create policy "Contacts are owned by the user" on contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DEALS ------------------------------------------------------------------
create table if not exists deals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  contact_id uuid references contacts (id) on delete set null,
  title text not null,
  value numeric,
  stage text not null default 'lead'
    check (stage in ('lead','contacted','proposal','negotiation','won','lost')),
  created_at timestamptz not null default now()
);

alter table deals enable row level security;

create policy "Deals are owned by the user" on deals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- TASKS ------------------------------------------------------------------
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  contact_id uuid references contacts (id) on delete set null,
  deal_id uuid references deals (id) on delete set null,
  title text not null,
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "Tasks are owned by the user" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ACTIVITY NOTES -----------------------------------------------------------
create table if not exists activity_notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  contact_id uuid references contacts (id) on delete cascade,
  deal_id uuid references deals (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table activity_notes enable row level security;

create policy "Notes are owned by the user" on activity_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helpful indexes
create index if not exists deals_contact_id_idx on deals (contact_id);
create index if not exists tasks_contact_id_idx on tasks (contact_id);
create index if not exists tasks_deal_id_idx on tasks (deal_id);
create index if not exists activity_notes_contact_id_idx on activity_notes (contact_id);
create index if not exists activity_notes_deal_id_idx on activity_notes (deal_id);

-- LEADS (synced with the LeadScout desktop tool) ---------------------------
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  place_id text not null,
  name text not null,
  industry text,
  city text,
  address text,
  phone text,
  website text,
  rating numeric,
  reviews integer,
  types jsonb not null default '[]'::jsonb,
  is_open boolean,
  status text not null default 'new'
    check (status in ('new','contacted','noanswer','interested','proposal','notinterested','notvalid')),
  -- The person you actually speak to at the business, captured on the call.
  -- Distinct from `name`, which is the business name from Google Places.
  contact_name text,
  contact_email text,
  notes text,
  call_log jsonb not null default '[]'::jsonb,
  manual_has_site boolean not null default false,
  site_url text,
  maps_url text,
  search_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, place_id)
);

alter table leads enable row level security;

create policy "Leads are owned by the user" on leads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists leads_status_idx on leads (status);
create index if not exists leads_city_idx on leads (city);

-- keep updated_at current on every write
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_updated_at on leads;
create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

-- SCHEDULED CALLS (replaces the generic Tasks feature) -------------------
-- A simple log of an upcoming Zoom/phone call: who with, how to reach them,
-- and roughly when. Day/time are free text (leads often just say "Thursday
-- evening") rather than a strict date, so only the contact name is required.
create table if not exists scheduled_calls (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  contact_name text not null,
  phone text,
  email text,
  day text,
  time text,
  note text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table scheduled_calls enable row level security;

create policy "Scheduled calls are owned by the user" on scheduled_calls
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists scheduled_calls_created_at_idx on scheduled_calls (created_at);
