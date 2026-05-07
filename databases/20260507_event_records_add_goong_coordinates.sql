-- Migration: Add Goong coordinates to event_records.
-- Safe for existing data: columns are nullable for backfill compatibility.

alter table public.event_records
	add column if not exists goong_latitude double precision,
	add column if not exists goong_longitude double precision;

create index if not exists idx_event_records_goong_coordinates
	on public.event_records (goong_latitude, goong_longitude);

do $$
begin
	if not exists (
		select 1
		from pg_constraint
		where conname = 'event_records_goong_coordinates_pair_check'
	) then
		alter table public.event_records
			add constraint event_records_goong_coordinates_pair_check
			check (
				(goong_latitude is null and goong_longitude is null)
				or (goong_latitude is not null and goong_longitude is not null)
			);
	end if;

	if not exists (
		select 1
		from pg_constraint
		where conname = 'event_records_goong_latitude_range_check'
	) then
		alter table public.event_records
			add constraint event_records_goong_latitude_range_check
			check (goong_latitude is null or (goong_latitude between -90 and 90));
	end if;

	if not exists (
		select 1
		from pg_constraint
		where conname = 'event_records_goong_longitude_range_check'
	) then
		alter table public.event_records
			add constraint event_records_goong_longitude_range_check
			check (goong_longitude is null or (goong_longitude between -180 and 180));
	end if;
end;
$$;
