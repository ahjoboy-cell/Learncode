export interface TeamMember {
  id: string;
  name: string;
  pin: string;
  role: "admin" | "counter";
  created_at: string;
}

export interface Vendor {
  id: string;
  name: string;
  address: string;
  contact_person: string;
  phone: string;
  email: string;
  notes: string;
  created_at: string;
}

export interface Sku {
  id: string;
  sku_code: string;
  name: string;
  description: string;
  category: string;
  unit_cost: number;
  retail_price: number;
  commission_per_unit: number;
  image_url?: string;
  created_at: string;
}

export interface VendorSku {
  id: string;
  vendor_id: string;
  sku_id: string;
  min_stock_level: number;
  current_expected_stock: number;
}

export interface StockCheck {
  id: string;
  vendor_id: string;
  checked_by: string;
  check_date: string;
  status: "in_progress" | "completed";
  notes: string;
  created_at: string;
}

export interface StockCheckItem {
  id: string;
  stock_check_id: string;
  sku_id: string;
  expected_qty: number;
  counted_qty: number;
  discrepancy: number;
  notes: string;
}

export interface Replenishment {
  id: string;
  vendor_id: string;
  sku_id: string;
  qty: number;
  direction: "sent" | "sold";
  date: string;
  logged_by: string;
  notes: string;
  created_at: string;
}

export interface Sale {
  id: string;
  vendor_id: string;
  sku_id: string;
  qty_sold: number;
  sale_price: number;
  commission_amount: number;
  date: string;
  created_at: string;
}

export interface Settlement {
  id: string;
  vendor_id: string;
  period_start: string;
  period_end: string;
  total_owed: number;
  total_paid: number;
  status: "pending" | "paid";
  created_at: string;
}

export interface Alert {
  id: string;
  type: "low_stock" | "discrepancy" | "shrinkage";
  vendor_id: string;
  sku_id: string;
  message: string;
  resolved: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  performed_by: string;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  order_date: string;
  expected_delivery_date: string;
  status: "draft" | "sent" | "acknowledged" | "shipped" | "received" | "cancelled";
  total_amount: number;
  notes: string;
  created_by: string;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  sku_id: string;
  qty: number;
  unit_cost: number;
  line_total: number;
  received_qty: number;
  notes: string;
}

export interface VendorInvoice {
  id: string;
  invoice_number: string;
  vendor_id: string;
  purchase_order_id: string | null;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  status: "pending" | "approved" | "partially_paid" | "paid" | "overdue" | "cancelled";
  notes: string;
  created_at: string;
}
