-- SKU Tracker table
-- Run this migration when connecting to Supabase

create table if not exists skus (
  id uuid primary key default gen_random_uuid(),
  sku_code text unique not null,
  product_name text not null default '',
  description text default '',
  unit text default 'pcs',
  quantity integer not null default 0,
  low_stock_threshold integer default 10,
  vendor_id uuid references vendors(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast lookups by sku_code
create index if not exists idx_skus_sku_code on skus(sku_code);

-- Index for low stock queries
create index if not exists idx_skus_quantity on skus(quantity);

-- Auto-update updated_at
create or replace function update_skus_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger skus_updated_at
  before update on skus
  for each row
  execute function update_skus_updated_at();

-- Enable RLS (adjust policies as needed for your auth setup)
alter table skus enable row level security;
