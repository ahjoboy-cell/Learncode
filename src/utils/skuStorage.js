import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'sku_tracker_items';

export function getSkus() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveAll(skus) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(skus));
  return skus;
}

export function saveSku(sku) {
  const skus = getSkus();
  const index = skus.findIndex((s) => s.id === sku.id);
  const now = new Date().toISOString();
  if (index >= 0) {
    skus[index] = { ...sku, updatedAt: now };
  } else {
    skus.push({ ...sku, id: sku.id || uuidv4(), createdAt: now, updatedAt: now });
  }
  return saveAll(skus);
}

export function deleteSku(id) {
  return saveAll(getSkus().filter((s) => s.id !== id));
}

/**
 * Upsert SKUs by sku_code: update existing, insert new.
 * Returns the updated list.
 */
export function upsertSkus(incoming) {
  const skus = getSkus();
  const now = new Date().toISOString();

  for (const item of incoming) {
    const code = (item.sku_code || '').trim();
    if (!code) continue;

    const index = skus.findIndex((s) => s.sku_code === code);
    if (index >= 0) {
      // Update existing — merge fields, keep id
      skus[index] = {
        ...skus[index],
        product_name: item.product_name ?? skus[index].product_name,
        description: item.description ?? skus[index].description,
        unit: item.unit ?? skus[index].unit,
        quantity: item.quantity != null ? Number(item.quantity) : skus[index].quantity,
        low_stock_threshold: item.low_stock_threshold != null ? Number(item.low_stock_threshold) : skus[index].low_stock_threshold,
        vendor_id: item.vendor_id ?? skus[index].vendor_id,
        updatedAt: now,
      };
    } else {
      // Insert new
      skus.push({
        id: uuidv4(),
        sku_code: code,
        product_name: item.product_name || '',
        description: item.description || '',
        unit: item.unit || 'pcs',
        quantity: item.quantity != null ? Number(item.quantity) : 0,
        low_stock_threshold: item.low_stock_threshold != null ? Number(item.low_stock_threshold) : 10,
        vendor_id: item.vendor_id || null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return saveAll(skus);
}
