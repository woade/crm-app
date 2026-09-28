-- Business hours, so you can see whether a lead is open before you dial.
--
-- LeadScout has always captured hours from Google Places, but it never sent
-- them: leadToRow() left the field out and there was nowhere here to put it.
-- The one opening-related column that DID sync, is_open, is a snapshot taken
-- at scan time, so by the time you call it is telling you whether the shop was
-- open last Tuesday. Storing the weekly schedule instead means open/closed can
-- be worked out live, on whichever device is asking.
--
-- Safe to run on a database that already has data: both columns are nullable
-- and nothing reads them until the app is updated.

alter table leads add column if not exists hours text;

-- Minutes from UTC for the BUSINESS's own timezone, straight from the Places
-- API (utcOffsetMinutes). Without it, a lead in another state gets judged
-- against your phone's clock, which is exactly the hour-off mistake that makes
-- you call a closed shop. Null means "unknown", and the app falls back to
-- device local time rather than guessing.
alter table leads add column if not exists utc_offset_minutes integer;

-- Backfill helper for leads that are already in the cloud.
--
-- LeadScout only pushes rows it changed locally since the last sync, which is
-- deliberate: pushing everything is what used to overwrite status changes made
-- on the phone. But it means the hundreds of existing leads would never send
-- their hours, and the badge would stay blank on every one of them until the
-- lead happened to be edited.
--
-- So rather than loosening the push rule, this updates ONLY the two new
-- columns. Status, notes, call log and updated_at are untouched, so it cannot
-- clobber work done on the phone and cannot disturb the delta sync.
create or replace function backfill_lead_hours(payload jsonb)
returns integer
language plpgsql
security invoker            -- runs as the caller, so RLS still applies
as $$
declare
  updated integer;
begin
  update leads l
     set hours = e.hours,
         utc_offset_minutes = e.utc_offset_minutes
    from jsonb_to_recordset(payload)
      as e(place_id text, hours text, utc_offset_minutes integer)
   where l.place_id = e.place_id
     and l.user_id = auth.uid();   -- belt and braces alongside RLS
  get diagnostics updated = row_count;
  return updated;
end;
$$;

grant execute on function backfill_lead_hours(jsonb) to authenticated;
