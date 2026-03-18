import { useState, useCallback } from 'react';
import { getSkus, saveSku, deleteSku as removeFromStorage, upsertSkus } from '../utils/skuStorage';

export function useSkus() {
  const [skus, setSkus] = useState(() => getSkus());

  const refresh = useCallback(() => setSkus(getSkus()), []);

  const addOrUpdate = useCallback((sku) => {
    const updated = saveSku(sku);
    setSkus(updated);
  }, []);

  const remove = useCallback((id) => {
    const updated = removeFromStorage(id);
    setSkus(updated);
  }, []);

  const bulkUpsert = useCallback((items) => {
    const updated = upsertSkus(items);
    setSkus(updated);
    return updated;
  }, []);

  return { skus, addOrUpdate, remove, bulkUpsert, refresh };
}
