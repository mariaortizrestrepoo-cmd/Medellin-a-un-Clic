-- Medellín a un clic — Reservas de tours con Bold y Google Calendar (Mokea Digital LLC)
-- Se corre UNA vez en Supabase (SQL Editor). Se puede volver a correr sin dañar nada.
-- Las 3 tablas quedan cerradas: solo la función "medellin-reservas" (servidor) las lee y escribe.

-- 1) AJUSTES: tasa, anticipo, recargos... (se editan en Table Editor como una hoja de cálculo)
create table if not exists public.mde_ajustes (
  clave text primary key,
  valor jsonb not null,
  nota  text
);
insert into public.mde_ajustes (clave, valor, nota) values
  ('tasa',            '3461',  'Pesos por dólar. Se actualiza una vez al mes.'),
  ('anticipo',        '0.20',  'Anticipo: 0.20 = 20 %'),
  ('diasMinimos',     '2',     'Días mínimos de anticipación para reservar'),
  ('grupos',          '["1-3","4-6","7-10","11-16"]', 'Tamaños de grupo (no cambiar sin avisar a la app)'),
  ('horaExtra',       '[30,30,35,40]', 'US$ por hora adicional según el grupo (se paga el día del tour)'),
  ('aeroRecargo',     '10',    'US$ por trayecto para hoteles en los municipios de la lista'),
  ('aeroMunicipios',  '["Bello","Copacabana","Girardota","Barbosa","Itagüí","Envigado","Sabaneta","La Estrella","Caldas"]', 'Municipios con recargo'),
  ('aeroSinRecargo',  '["Rionegro","Llanogrande","La Ceja"]', 'Mismo precio que Medellín'),
  ('aeroGuatapeUSD',  '[115,140,170,190]', 'Aeropuerto ↔ Guatapé, US$ por trayecto según el grupo (precio final; se cobra en pesos con la tasa)'),
  ('nocturno',        '{"desde":"22:00","hasta":"04:00","porcentaje":15}', 'Recargo nocturno por trayecto'),
  ('lucesTemporada',  '{"desde":"12-01","hasta":"01-10"}', 'Temporada del Tour de Luces (mes-día)')
on conflict (clave) do nothing;

-- 2) TOURS Y PRECIOS (US$ por grupo). "horas" = duración aproximada para el calendario de Paola.
create table if not exists public.mde_tours (
  id           text primary key,
  orden        int  not null default 0,
  nombre_es    text not null,
  nombre_en    text not null,
  precio_1_3   numeric not null,
  precio_4_6   numeric not null,
  precio_7_10  numeric not null,
  precio_11_16 numeric not null,
  horas        numeric not null default 4,
  aeropuerto   boolean not null default false,
  temporada    text,
  activo       boolean not null default true
);
insert into public.mde_tours (id, orden, nombre_es, nombre_en, precio_1_3, precio_4_6, precio_7_10, precio_11_16, horas, aeropuerto, temporada) values
  ('aeropuerto',   1, 'Aeropuerto', 'Airport',                            60,  65,  80, 115,  2, true,  null),
  ('city',         2, 'City Tour', 'City Tour',                           95, 105, 120, 135,  5, false, null),
  ('comuna13',     3, 'Comuna 13', 'Comuna 13',                           95, 105, 120, 135,  4, false, null),
  ('flores',       4, 'Tour de Flores (Santa Elena)', 'Flower Tour (Santa Elena)', 95, 105, 120, 135, 5, false, null),
  ('luces',        5, 'Tour de Luces', 'Christmas Lights Tour',           95, 105, 120, 135,  4, false, 'luces'),
  ('tequendamita', 6, 'Tequendamita', 'Tequendamita',                    100, 115, 125, 150,  5, false, null),
  ('sanfelix',     7, 'San Félix', 'San Félix',                          125, 140, 170, 210,  5, false, null),
  ('cuatrimotos',  8, 'Cuatrimotos', 'ATV ride',                         175, 215, 260, 285,  5, false, null),
  ('guatape',      9, 'Guatapé y El Peñol', 'Guatapé and El Peñol',      230, 275, 295, 320, 10, false, null),
  ('rioclaro',    10, 'Río Claro', 'Río Claro',                          315, 385, 435, 490, 12, false, null),
  ('napoles',     11, 'Hacienda Nápoles', 'Hacienda Nápoles',            490, 590, 660, 835, 14, false, null)
on conflict (id) do nothing;

-- 3) RESERVAS. Solo lo necesario del cliente: nombre, WhatsApp y correo.
create table if not exists public.mde_reservas (
  orden          text primary key,                 -- identificador de la venta en Bold
  creada         timestamptz not null default now(),
  modo           text not null default 'prueba',   -- 'prueba' o 'real'
  estado         text not null default 'pendiente' check (estado in ('pendiente','pagada','rechazada')),
  tour           text not null,
  grupo          text not null,
  pago           text not null check (pago in ('anticipo','total')),
  nombre         text not null,
  whatsapp       text not null,
  correo         text not null,
  idioma         text not null default 'en',
  detalle        jsonb not null,                   -- sitio, fechas, horas, vuelo, municipio, trayectos
  tasa           numeric not null,
  total_usd      numeric not null,
  total_cop      int not null,
  cobro_cop      int not null,                     -- lo que se cobra en Bold ahora
  resto_cop      int not null,                     -- lo que se paga el día del tour
  bold_id        text,                             -- id de la transacción en Bold
  pagada_en      timestamptz,
  eventos        text[] not null default '{}',     -- eventos creados en el calendario de Paola
  avisos         text,                             -- notas internas (p. ej. si falló un correo)
  ultima_fecha   date not null,                    -- último día del servicio
  borrar_despues date not null                     -- se borra 1 año y medio después del tour
);
create index if not exists mde_reservas_borrar on public.mde_reservas (borrar_despues);

alter table public.mde_ajustes  enable row level security;
alter table public.mde_tours    enable row level security;
alter table public.mde_reservas enable row level security;
-- (Sin políticas: desde la app nadie puede leer ni escribir directo. Solo el servidor.)

-- 4) BORRADO AUTOMÁTICO: reservas pagadas 1,5 años después del tour;
--    reservas sin pagar (pendientes o rechazadas) a los 7 días.
create or replace function public.mde_borrar_vencidas() returns int
language sql security definer set search_path = public as $$
  with b as (
    delete from public.mde_reservas
    where borrar_despues < current_date
       or (estado <> 'pagada' and creada < now() - interval '7 days')
    returning 1)
  select count(*)::int from b;
$$;
revoke all on function public.mde_borrar_vencidas() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.mde_borrar_vencidas() to service_role;
  end if;
end $$;
-- La función del servidor la llama sola. Si además quiere que corra cada día a las 3 a. m.
-- (Database → Extensions → pg_cron activado), puede correr esta línea:
-- select cron.schedule('mde-borrar-reservas', '0 8 * * *', 'select public.mde_borrar_vencidas()');
