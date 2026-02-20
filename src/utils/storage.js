const STORAGE_KEY = 'b2b_crm_leads';

export function getLeads() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveLead(lead) {
  const leads = getLeads();
  const index = leads.findIndex((l) => l.id === lead.id);
  if (index >= 0) {
    leads[index] = { ...lead, updatedAt: new Date().toISOString() };
  } else {
    leads.push({ ...lead, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  return leads;
}

export function deleteLead(id) {
  const leads = getLeads().filter((l) => l.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  return leads;
}

export function exportLeads() {
  const leads = getLeads();
  const blob = new Blob([JSON.stringify(leads, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crm-leads-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importLeads(jsonString) {
  const imported = JSON.parse(jsonString);
  if (!Array.isArray(imported)) throw new Error('Invalid format');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
  return imported;
}
