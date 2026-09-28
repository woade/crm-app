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
