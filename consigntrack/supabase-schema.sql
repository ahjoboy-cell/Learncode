-- ============================================================
-- Consignment Stock Tracking App - Supabase Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin text not null unique,
  role text not null check (role in ('admin', 'counter')),
  created_at timestamptz not null default now()
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  contact_person text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table skus (
  id uuid primary key default gen_random_uuid(),
  sku_code text not null unique,
  name text not null,
  description text,
  category text,
  unit_cost numeric(10,2) not null default 0,
  retail_price numeric(10,2) not null default 0,
  commission_per_unit numeric(10,2) not null default 0,
  image_url text,
  created_at timestamptz not null default now()
);

create table vendor_skus (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  sku_id uuid not null references skus(id) on delete cascade,
  min_stock_level integer not null default 0,
  current_expected_stock integer not null default 0,
  unique (vendor_id, sku_id)
);

create table stock_checks (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  checked_by uuid not null references team_members(id),
  check_date date not null default current_date,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  notes text,
  created_at timestamptz not null default now()
);

create table stock_check_items (
  id uuid primary key default gen_random_uuid(),
  stock_check_id uuid not null references stock_checks(id) on delete cascade,
  sku_id uuid not null references skus(id),
  expected_qty integer not null default 0,
  counted_qty integer not null default 0,
  discrepancy integer not null default 0,
  notes text
);

create table replenishments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  sku_id uuid not null references skus(id),
  qty integer not null,
  direction text not null check (direction in ('sent', 'sold')),
  date date not null default current_date,
  logged_by uuid not null references team_members(id),
  notes text,
  created_at timestamptz not null default now()
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  sku_id uuid not null references skus(id),
  qty_sold integer not null,
  sale_price numeric(10,2) not null,
  commission_amount numeric(10,2) not null default 0,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_owed numeric(10,2) not null default 0,
  total_paid numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('low_stock', 'discrepancy', 'shrinkage')),
  vendor_id uuid references vendors(id) on delete cascade,
  sku_id uuid references skus(id),
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details text,
  performed_by uuid references team_members(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- PURCHASE ORDERS & VENDOR INVOICES
-- ============================================================

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  vendor_id uuid not null references vendors(id) on delete cascade,
  order_date date not null default current_date,
  expected_delivery_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'acknowledged', 'shipped', 'received', 'cancelled')),
  total_amount numeric(10,2) not null default 0,
  notes text,
  created_by uuid references team_members(id),
  created_at timestamptz not null default now()
);

create table purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  sku_id uuid not null references skus(id),
  qty integer not null default 0,
  unit_cost numeric(10,2) not null default 0,
  line_total numeric(10,2) not null default 0,
  received_qty integer not null default 0,
  notes text
);

create table vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  vendor_id uuid not null references vendors(id) on delete cascade,
  purchase_order_id uuid references purchase_orders(id),
  invoice_date date not null default current_date,
  due_date date not null,
  subtotal numeric(10,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  amount_paid numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

-- RLS for new tables
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table vendor_invoices enable row level security;

create policy "Allow all" on purchase_orders for all using (true) with check (true);
create policy "Allow all" on purchase_order_items for all using (true) with check (true);
create policy "Allow all" on vendor_invoices for all using (true) with check (true);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_vendor_skus_vendor on vendor_skus(vendor_id);
create index idx_vendor_skus_sku on vendor_skus(sku_id);
create index idx_stock_checks_vendor on stock_checks(vendor_id);
create index idx_stock_checks_checked_by on stock_checks(checked_by);
create index idx_stock_checks_date on stock_checks(check_date);
create index idx_stock_check_items_check on stock_check_items(stock_check_id);
create index idx_stock_check_items_sku on stock_check_items(sku_id);
create index idx_replenishments_vendor on replenishments(vendor_id);
create index idx_replenishments_sku on replenishments(sku_id);
create index idx_replenishments_date on replenishments(date);
create index idx_sales_vendor on sales(vendor_id);
create index idx_sales_sku on sales(sku_id);
create index idx_sales_date on sales(date);
create index idx_settlements_vendor on settlements(vendor_id);
create index idx_alerts_vendor on alerts(vendor_id);
create index idx_alerts_type on alerts(type);
create index idx_alerts_resolved on alerts(resolved);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_performed_by on audit_logs(performed_by);

create index idx_purchase_orders_vendor on purchase_orders(vendor_id);
create index idx_purchase_orders_status on purchase_orders(status);
create index idx_purchase_orders_date on purchase_orders(order_date);
create index idx_purchase_order_items_po on purchase_order_items(purchase_order_id);
create index idx_purchase_order_items_sku on purchase_order_items(sku_id);
create index idx_vendor_invoices_vendor on vendor_invoices(vendor_id);
create index idx_vendor_invoices_po on vendor_invoices(purchase_order_id);
create index idx_vendor_invoices_status on vendor_invoices(status);
create index idx_vendor_invoices_due_date on vendor_invoices(due_date);

-- ============================================================
-- RLS DISABLED (using simple PIN auth, not Supabase auth)
-- ============================================================

alter table team_members enable row level security;
alter table vendors enable row level security;
alter table skus enable row level security;
alter table vendor_skus enable row level security;
alter table stock_checks enable row level security;
alter table stock_check_items enable row level security;
alter table replenishments enable row level security;
alter table sales enable row level security;
alter table settlements enable row level security;
alter table alerts enable row level security;
alter table audit_logs enable row level security;

-- Allow all operations via anon key (PIN auth handled in app layer)
create policy "Allow all" on team_members for all using (true) with check (true);
create policy "Allow all" on vendors for all using (true) with check (true);
create policy "Allow all" on skus for all using (true) with check (true);
create policy "Allow all" on vendor_skus for all using (true) with check (true);
create policy "Allow all" on stock_checks for all using (true) with check (true);
create policy "Allow all" on stock_check_items for all using (true) with check (true);
create policy "Allow all" on replenishments for all using (true) with check (true);
create policy "Allow all" on sales for all using (true) with check (true);
create policy "Allow all" on settlements for all using (true) with check (true);
create policy "Allow all" on alerts for all using (true) with check (true);
create policy "Allow all" on audit_logs for all using (true) with check (true);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-calculate discrepancy on stock_check_items insert or update
create or replace function fn_calc_discrepancy()
returns trigger as $$
begin
  new.discrepancy := new.expected_qty - new.counted_qty;
  return new;
end;
$$ language plpgsql;

create trigger trg_calc_discrepancy
  before insert or update on stock_check_items
  for each row
  execute function fn_calc_discrepancy();

-- Auto-create alert when discrepancy > 0 after stock_check_items insert/update
create or replace function fn_alert_on_discrepancy()
returns trigger as $$
declare
  v_vendor_id uuid;
begin
  if new.discrepancy <> 0 then
    -- Look up vendor_id from the parent stock_check
    select vendor_id into v_vendor_id
      from stock_checks
      where id = new.stock_check_id;

    insert into alerts (type, vendor_id, sku_id, message)
    values (
      case when new.discrepancy > 0 then 'shrinkage' else 'discrepancy' end,
      v_vendor_id,
      new.sku_id,
      'Stock check discrepancy: expected ' || new.expected_qty ||
        ', counted ' || new.counted_qty ||
        ' (diff ' || new.discrepancy || ')'
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_alert_on_discrepancy
  after insert or update on stock_check_items
  for each row
  execute function fn_alert_on_discrepancy();

-- Auto-create low_stock alert when vendor_sku current_expected_stock drops below min
create or replace function fn_alert_low_stock()
returns trigger as $$
begin
  if new.current_expected_stock < new.min_stock_level then
    insert into alerts (type, vendor_id, sku_id, message)
    values (
      'low_stock',
      new.vendor_id,
      new.sku_id,
      'Stock level (' || new.current_expected_stock ||
        ') is below minimum (' || new.min_stock_level || ')'
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_alert_low_stock
  after insert or update on vendor_skus
  for each row
  execute function fn_alert_low_stock();
