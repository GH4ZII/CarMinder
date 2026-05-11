-- Create incident_report_images table for storing incident photo metadata.
-- Apply this to your Supabase Postgres database.

create table if not exists public.incident_report_images (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incident_reports(id) on delete cascade,
  storage_path text not null,
  content_type text null,
  byte_size integer null,
  created_at timestamptz not null default now()
);

create index if not exists incident_report_images_incident_id_created_at_idx
  on public.incident_report_images (incident_id, created_at);

