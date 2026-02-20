import { useState, useCallback } from 'react';
import { getLeads, saveLead, deleteLead as removeFromStorage } from '../utils/storage';

export function useLeads() {
  const [leads, setLeads] = useState(() => getLeads());

  const refresh = useCallback(() => setLeads(getLeads()), []);

  const addOrUpdate = useCallback((lead) => {
    const updated = saveLead(lead);
    setLeads(updated);
  }, []);

  const remove = useCallback((id) => {
    const updated = removeFromStorage(id);
    setLeads(updated);
  }, []);

  return { leads, addOrUpdate, remove, refresh };
}
