export const STAGES = [
  { key: 'new', label: 'New', color: '#8b5cf6' },
  { key: 'contacted', label: 'Contacted', color: '#3b82f6' },
  { key: 'qualified', label: 'Qualified', color: '#06b6d4' },
  { key: 'proposal', label: 'Proposal', color: '#f59e0b' },
  { key: 'negotiation', label: 'Negotiation', color: '#f97316' },
  { key: 'won', label: 'Won', color: '#10b981' },
  { key: 'lost', label: 'Lost', color: '#ef4444' },
];

export const SOURCES = [
  'Website',
  'Referral',
  'LinkedIn',
  'Cold Call',
  'Trade Show',
  'Email Campaign',
  'Other',
];

export function getStageColor(stageKey) {
  return STAGES.find((s) => s.key === stageKey)?.color || '#94a3b8';
}

export function getStageLabel(stageKey) {
  return STAGES.find((s) => s.key === stageKey)?.label || stageKey;
}
