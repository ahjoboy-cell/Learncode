import { supabase } from './supabase';

export async function logAudit(
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  performedBy: string
) {
  try {
    await supabase.from('audit_logs').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      performed_by: performedBy,
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}
