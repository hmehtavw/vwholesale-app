-- ============================================================
-- TEMPORARY TILE STOCK DESK — core schema
-- All objects prefixed temp_tiles_ for clean removal.
-- Removal: see /tiles/README-TEMPORARY.md
-- ============================================================

-- ---------- access ----------
create table temp_tiles_users (
  id           uuid primary key default gen_random_uuid(),
  role         text not null check (role in ('ADMIN','INVENTORY','SALES')),
  pin_hash     text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (role)
);

create table temp_tiles_sessions (
  token        text primary key,
  role         text not null check (role in ('ADMIN','INVENTORY','SALES')),
  staff_name   text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz
);
create index on temp_tiles_sessions (expires_at);

-- ---------- reference data ----------
create table temp_tiles_locations (
  id                       uuid primary key default gen_random_uuid(),
  location_code            text unique,
  location_name            text not null,
  normalized_location_name text not null,
  location_type            text not null default 'OTHER'
                           check (location_type in ('STAND','RACK','GODOWN_RACK','BACK_RACK','ACCESSORY','OTHER')),
  zone                     text,
  is_active                boolean not null default true,
  raw_variants             text,
  metadata                 jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  unique (normalized_location_name)      -- blocks duplicates after normalisation
);

create table temp_tiles_models (
  id                     uuid primary key default gen_random_uuid(),
  model_code             text not null,
  normalized_model_code  text not null,
  model_name             text,
  brand                  text,
  size                   text,
  category               text,
  unit                   text not null default 'BOX',
  is_active              boolean not null default true,
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  unique (normalized_model_code)         -- '10395 - L' and '10395-L' cannot coexist
);
create index on temp_tiles_models (normalized_model_code text_pattern_ops);

-- ---------- stock ----------
create table temp_tiles_stock (
  id                    uuid primary key default gen_random_uuid(),
  model_id              uuid not null references temp_tiles_models(id),
  location_id           uuid not null references temp_tiles_locations(id),
  opening_qty           numeric not null default 0 check (opening_qty >= 0),
  current_physical_qty  numeric not null default 0 check (current_physical_qty >= 0),
  original_source_opening_qty numeric,      -- audit only, pre-migration figure
  is_active             boolean not null default true,
  row_version           bigint not null default 1,
  updated_at            timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  unique (model_id, location_id)            -- never merge separate physical locations
);
create index on temp_tiles_stock (model_id);

-- ---------- holds (header + lines) ----------
create table temp_tiles_holds (
  id                   uuid primary key default gen_random_uuid(),
  hold_number          text not null unique,
  customer_name        text not null,
  customer_mobile      text not null,
  advance_amount       numeric not null check (advance_amount > 0),   -- mandatory
  receipt_reference    text not null,
  receipt_photo_url    text,
  confirmation_status  text not null default 'UNCONFIRMED'
                       check (confirmation_status in ('UNCONFIRMED','CONFIRMED')),
  expiry_date          date not null,
  salesperson_name     text not null,
  status               text not null default 'ACTIVE'
                       check (status in ('ACTIVE','PARTIAL','CONVERTED','RELEASED','EXPIRED','CANCELLED')),
  total_qty            numeric not null default 0 check (total_qty >= 0),
  notes                text,
  idempotency_key      text unique,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index on temp_tiles_holds (status, expiry_date);
create index on temp_tiles_holds (customer_mobile);

create table temp_tiles_hold_lines (
  id             uuid primary key default gen_random_uuid(),
  hold_id        uuid not null references temp_tiles_holds(id) on delete cascade,
  model_id       uuid not null references temp_tiles_models(id),
  location_id    uuid not null references temp_tiles_locations(id),
  original_qty   numeric not null check (original_qty > 0),
  converted_qty  numeric not null default 0 check (converted_qty >= 0),
  released_qty   numeric not null default 0 check (released_qty >= 0),
  balance_qty    numeric not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (hold_id, model_id, location_id),
  -- INVARIANT 2: a line must always account for itself
  constraint hold_line_balances
    check (original_qty = converted_qty + released_qty + balance_qty),
  constraint hold_line_balance_nonneg check (balance_qty >= 0)
);
create index on temp_tiles_hold_lines (model_id, location_id) where balance_qty > 0;

-- ---------- sale orders (header + movement lines) ----------
create table temp_tiles_sale_orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique,
  customer_name     text,
  customer_mobile   text,
  invoice_reference text not null,
  photo_url         text,
  photo_status      text not null default 'PENDING'
                    check (photo_status in ('PENDING','UPLOADED','FAILED')),
  entered_by_name   text not null,
  entered_by_role   text not null,
  hold_id           uuid references temp_tiles_holds(id),  -- set when converted from a hold
  total_qty         numeric not null default 0 check (total_qty >= 0),
  notes             text,
  idempotency_key   text unique,
  created_at        timestamptz not null default now()
);
create index on temp_tiles_sale_orders (invoice_reference);
create index on temp_tiles_sale_orders (photo_status) where photo_status <> 'UPLOADED';

create table temp_tiles_movements (
  id                   uuid primary key default gen_random_uuid(),
  sale_order_id        uuid references temp_tiles_sale_orders(id) on delete cascade,
  hold_id              uuid references temp_tiles_holds(id),
  movement_type        text not null check (movement_type in
                       ('SALE','INWARD','DAMAGE','ADJUSTMENT_PLUS','ADJUSTMENT_MINUS',
                        'TRANSFER_OUT','TRANSFER_IN','HOLD_CONVERSION_SALE','REVERSAL')),
  model_id             uuid not null references temp_tiles_models(id),
  location_id          uuid not null references temp_tiles_locations(id),
  qty                  numeric not null check (qty > 0),
  signed_qty           numeric not null,
  entered_by_name      text not null,
  entered_by_role      text not null,
  notes                text,
  status               text not null default 'POSTED'
                       check (status in ('POSTED','REVERSED')),
  reversed_movement_id uuid references temp_tiles_movements(id),
  created_at           timestamptz not null default now()
);
create index on temp_tiles_movements (model_id, location_id, created_at desc);
create index on temp_tiles_movements (sale_order_id);

-- ---------- approvals (inward / damage / adjustment / transfer) ----------
create table temp_tiles_approvals (
  id               uuid primary key default gen_random_uuid(),
  request_type     text not null check (request_type in
                   ('INWARD','DAMAGE','ADJUSTMENT_PLUS','ADJUSTMENT_MINUS','TRANSFER')),
  payload          jsonb not null,          -- lines: model, location, qty
  requested_by     text not null,
  requested_role   text not null,
  status           text not null default 'PENDING'
                   check (status in ('PENDING','APPROVED','REJECTED')),
  decided_by       text,
  decided_at       timestamptz,
  decision_note    text,
  committed_at     timestamptz,
  idempotency_key  text unique,
  created_at       timestamptz not null default now()
);
create index on temp_tiles_approvals (status, created_at desc);

-- ---------- withheld rows awaiting a physical location ----------
create table temp_tiles_pending_locations (
  id             uuid primary key default gen_random_uuid(),
  model_code     text not null,
  item_name      text,
  brand          text,
  size           text,
  qty            numeric not null check (qty >= 0),
  raw_location   text,
  reason         text not null,             -- UNSPECIFIED | COMPOUND | POLICY_REVIEW
  source_sheet   text,
  notes          text,
  resolved_at    timestamptz,
  resolved_by    text,
  created_at     timestamptz not null default now()
);

-- ---------- audit + settings ----------
create table temp_tiles_audit_log (
  id            bigserial primary key,
  staff_name    text,
  role          text,
  action        text not null,
  model_code    text,
  location_name text,
  qty           numeric,
  reference     text,
  before_state  jsonb,
  after_state   jsonb,
  session_info  jsonb,
  created_at    timestamptz not null default now()
);
create index on temp_tiles_audit_log (created_at desc);
create index on temp_tiles_audit_log (action);

create table temp_tiles_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

insert into temp_tiles_settings (key, value) values
  ('default_hold_validity_days', '15'::jsonb),
  ('sales_max_hold_validity_days', '15'::jsonb),
  ('advance_mandatory',           'true'::jsonb),
  ('receipt_photo_required',      'true'::jsonb),
  ('sale_photo_required',         'true'::jsonb),
  ('expired_holds_auto_release',  'false'::jsonb),
  ('session_timeout_minutes',     '60'::jsonb);

-- ============================================================
-- INVARIANT 1 + 4: header totals must equal the sum of their lines
-- ============================================================
create or replace function temp_tiles_sync_hold_total() returns trigger
language plpgsql as $$
declare h uuid;
begin
  h := coalesce(new.hold_id, old.hold_id);
  update temp_tiles_holds
     set total_qty = (select coalesce(sum(original_qty),0)
                        from temp_tiles_hold_lines where hold_id = h),
         updated_at = now()
   where id = h;
  return null;
end $$;

create trigger trg_hold_total
after insert or update or delete on temp_tiles_hold_lines
for each row execute function temp_tiles_sync_hold_total();

create or replace function temp_tiles_sync_order_total() returns trigger
language plpgsql as $$
declare o uuid;
begin
  o := coalesce(new.sale_order_id, old.sale_order_id);
  if o is null then return null; end if;
  update temp_tiles_sale_orders
     set total_qty = (select coalesce(sum(qty),0)
                        from temp_tiles_movements
                       where sale_order_id = o and status = 'POSTED')
   where id = o;
  return null;
end $$;

create trigger trg_order_total
after insert or update or delete on temp_tiles_movements
for each row execute function temp_tiles_sync_order_total();

-- ============================================================
-- INVARIANT 3: available = physical − active hold balances
-- View, so it can never drift out of step with the tables.
-- ============================================================
create or replace view temp_tiles_stock_view as
select
  s.id                as stock_id,
  m.id                as model_id,
  m.model_code,
  m.normalized_model_code,
  m.model_name, m.brand, m.size, m.unit,
  l.id                as location_id,
  l.location_name, l.location_type,
  s.current_physical_qty                                    as physical_qty,
  coalesce(h.active_held, 0)                                as held_qty,
  coalesce(h.expired_held, 0)                               as expired_held_qty,
  s.current_physical_qty - coalesce(h.active_held, 0)       as available_qty,
  s.is_active, s.updated_at
from temp_tiles_stock s
join temp_tiles_models    m on m.id = s.model_id
join temp_tiles_locations l on l.id = s.location_id
left join lateral (
  select
    sum(hl.balance_qty)                                                  as active_held,
    sum(hl.balance_qty) filter (where hd.expiry_date < current_date)     as expired_held
  from temp_tiles_hold_lines hl
  join temp_tiles_holds hd on hd.id = hl.hold_id
  where hl.model_id = s.model_id
    and hl.location_id = s.location_id
    and hd.status in ('ACTIVE','PARTIAL')
    and hl.balance_qty > 0
) h on true;

-- ---------- lock everything down; edge functions use service role ----------
alter table temp_tiles_users             enable row level security;
alter table temp_tiles_sessions          enable row level security;
alter table temp_tiles_locations         enable row level security;
alter table temp_tiles_models            enable row level security;
alter table temp_tiles_stock             enable row level security;
alter table temp_tiles_holds             enable row level security;
alter table temp_tiles_hold_lines        enable row level security;
alter table temp_tiles_sale_orders       enable row level security;
alter table temp_tiles_movements         enable row level security;
alter table temp_tiles_approvals         enable row level security;
alter table temp_tiles_pending_locations enable row level security;
alter table temp_tiles_audit_log         enable row level security;
alter table temp_tiles_settings          enable row level security;
-- No policies are created: with RLS on and no policy, anon/authenticated get
-- nothing. Only the service role (edge functions) bypasses RLS. This is the
-- "browser has no direct table access" decision, enforced at the database.
