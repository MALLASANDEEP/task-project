alter table if exists public.notifications
  add column if not exists link_path text;
