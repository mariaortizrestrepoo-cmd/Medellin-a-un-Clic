-- Medellín 8 / 15 — tabla de compradores (Mokea Digital LLC)
create table if not exists public.mde_buyers (
  email          text primary key,
  created_at     timestamptz not null default now(),
  source         text,
  device_id      text,
  session_token  text,
  moves          int not null default 0,
  activated_at   timestamptz,
  code_hash      text,
  code_expires   timestamptz,
  code_attempts  int not null default 0,
  last_code_sent timestamptz
);
-- Solo la función del servidor puede leer/escribir (nadie desde afuera)
alter table public.mde_buyers enable row level security;
