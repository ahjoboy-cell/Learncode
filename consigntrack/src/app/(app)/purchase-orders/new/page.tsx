"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Vendor, Sku } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";

interface LineItem {
  sku_id: string;
  qty: number;
  unit_cost: number;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [saving, setSaving] = useState(false);

  const [vendorId, setVendorId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ sku_id: "", qty: 1, unit_cost: 0 }]);

  useEffect(() => {
    Promise.all([
      supabase.from("vendors").select("*").order("name"),
      supabase.from("skus").select("*").order("name"),
    ]).then(([vRes, sRes]) => {
      if (vRes.data) setVendors(vRes.data);
      if (sRes.data) setSkus(sRes.data);
    });
  }, []);

  function addLine() {
    setItems([...items, { sku_id: "", qty: 1, unit_cost: 0 }]);
  }

  function removeLine(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...items];
    if (field === "sku_id") {
      updated[index].sku_id = value as string;
      const sku = skus.find((s) => s.id === value);
      if (sku) updated[index].unit_cost = sku.unit_cost;
    } else if (field === "qty") {
      updated[index].qty = Math.max(1, Number(value));
    } else if (field === "unit_cost") {
      updated[index].unit_cost = Math.max(0, Number(value));
    }
    setItems(updated);
  }

  const totalAmount = items.reduce((sum, item) => sum + item.qty * item.unit_cost, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId) return alert("Please select a vendor.");
    const validItems = items.filter((i) => i.sku_id);
    if (validItems.length === 0) return alert("Add at least one line item.");

    setSaving(true);
    try {
      // Generate PO number
      const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;

      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          po_number: poNumber,
          vendor_id: vendorId,
          order_date: orderDate,
          expected_delivery_date: expectedDelivery || null,
          status: "draft",
          total_amount: totalAmount,
          notes: notes || null,
          created_by: currentUser?.id || null,
        })
        .select()
        .single();

      if (poError) throw poError;

      // Insert line items
      const lineItems = validItems.map((item) => ({
        purchase_order_id: po.id,
        sku_id: item.sku_id,
        qty: item.qty,
        unit_cost: item.unit_cost,
        line_total: item.qty * item.unit_cost,
        received_qty: 0,
      }));

      const { error: itemsError } = await supabase.from("purchase_order_items").insert(lineItems);
      if (itemsError) throw itemsError;

      await logAudit("create", "purchase_order", po.id, `Created PO ${poNumber}`, currentUser?.id ?? "");
      router.push("/purchase-orders");
    } catch (err) {
      alert(`Failed to create PO: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Purchase Order</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PO Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Order Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select vendor...</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Date *</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
              <input
                type="date"
                value={expectedDelivery}
                onChange={(e) => setExpectedDelivery(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary-600 font-medium hover:bg-primary-50 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-5">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">SKU</label>}
                  <select
                    value={item.sku_id}
                    onChange={(e) => updateLine(i, "sku_id", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select SKU...</option>
                    {skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sku_code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>}
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => updateLine(i, "qty", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Unit Cost</label>}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unit_cost}
                    onChange={(e) => updateLine(i, "unit_cost", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Line Total</label>}
                  <p className="py-2 text-sm font-semibold text-gray-900 tabular-nums">
                    ${(item.qty * item.unit_cost).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="col-span-1">
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">&nbsp;</label>}
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <div className="text-right">
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Creating..." : "Create Purchase Order"}
          </button>
        </div>
      </form>
    </div>
  );
}
