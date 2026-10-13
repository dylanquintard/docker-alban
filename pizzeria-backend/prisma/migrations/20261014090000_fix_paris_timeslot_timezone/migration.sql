-- Existing slots were created while the application ran in UTC, even though
-- their wall-clock values were entered for the Europe/Paris service area.
-- Re-store them as UTC instants so all clients display the intended local time.
UPDATE "TimeSlot"
SET
  "startTime" = ("startTime" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC',
  "endTime" = ("endTime" AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'UTC';
