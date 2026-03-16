"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Vendor, Sku } from "@/lib/types";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Package,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface LineItem {
  id: string;
  sku_id: string;
  qty: number;
}

export default function NewReplenishmentPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [vendorSkuIds, setVendorSkuIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [vendorId, setVendorId] = useState("");
  const [direction, setDirection] = useState<"sent" | "sold">("sent");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), sku_id: "", qty: 1 },
  ]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (vendorId) {
      fetchVendorSkus(vendorId);
    } else {
      setVendorSkuIds([]);
    }
  }, [vendorId]);

  async function fetchInitialData() {
    const [vendorsRes, skusRes] = await Promise.all([
      supabase.from("vendors").select("*").order("name"),
      supabase.from("skus").select("*").order("name"),
    ]);
    if (vendorsRes.data) setVendors(vendorsRes.data);
    if (skusRes.data) setSkus(skusRes.data);
    setLoading(false);
  }

  async function fetchVendorSkus(vId: string) {
    const { data } = await supabase
      .from("vendor_skus")
      .select("sku_id")
      .eq("vendor_id", vId);
    if (data) {
      setVendorSkuIds(data.map((vs) => vs.sku_id));
    }
  }

  // SKUs available for this vendor (all SKUs if no vendor_skus mapping exists)
  const availableSkus =
    vendorSkuIds.length > 0
      ? skus.filter((s) => vendorSkuIds.includes(s.id))
      : skus;

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), sku_id: "", qty: 1 },
    ]);
  }

  function removeLineItem(id: string) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  function updateLineItem(id: string, field: "sku_id" | "qty", value: string | number) {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!vendorId) {
      setError("Please select a vendor.");
      return;
    }

    const validItems = lineItems.filter((li) => li.sku_id && li.qty > 0);
    if (validItems.length === 0) {
      setError("Please add at least one line item with a SKU and quantity.");
      return;
    }

    if (!currentUser) {
      setError("You must be logged in to log replenishments.");
      return;
    }

    setSubmitting(true);

    try {
      // Insert all line items as replenishment rows
      const rows = validItems.map((li) => ({
        vendor_id: vendorId,
        sku_id: li.sku_id,
        qty: li.qty,
        direction,
        date,
        logged_by: currentUser.id,
        notes,
      }));

      const { error: insertError } = await supabase
        .from("replenishments")
        .insert(rows);

      if (insertError) throw insertError;

      // Update vendor_skus.current_expected_stock for each line item
      for (const li of validItems) {
        const stockDelta = direction === "sent" ? li.qty : -li.qty;

        // Check if vendor_sku row exists
        const { data: existingVs } = await supabase
          .from("vendor_skus")
          .select("id, current_expected_stock")
          .eq("vendor_id", vendorId)
          .eq("sku_id", li.sku_id)
          .single();

        if (existingVs) {
          await supabase
            .from("vendor_skus")
            .update({
              current_expected_stock:
                (existingVs.current_expected_stock || 0) + stockDelta,
            })
            .eq("id", existingVs.id);
        } else {
          // Create vendor_sku row if it doesn't exist
          await supabase.from("vendor_skus").insert({
            vendor_id: vendorId,
            sku_id: li.sku_id,
            min_stock_level: 0,
            current_expected_stock: Math.max(0, stockDelta),
          });
        }
      }

      // Log to audit_logs
      const vendorName =
        vendors.find((v) => v.id === vendorId)?.name ?? "Unknown";
      const skuSummary = validItems
        .map((li) => {
          const sku = skus.find((s) => s.id === li.sku_id);
          return `${sku?.sku_code ?? "?"} x${li.qty}`;
        })
        .join(", ");

      await supabase.from("audit_logs").insert({
        action: `replenishment_${direction}`,
        entity_type: "replenishment",
        entity_id: vendorId,
        details: `${direction === "sent" ? "Sent to" : "Sold/reported for"} ${vendorName}: ${skuSummary}`,
        performed_by: currentUser.id,
      });

      router.push("/replenishment");
    } catch (err: any) {
      setError(err.message || "Failed to save replenishment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/replenishment")}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Log Replenishment
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Record stock sent to a vendor or sales reported
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vendor Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vendor
          </label>
          <select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              // Reset line items when vendor changes
              setLineItems([{ id: crypto.randomUUID(), sku_id: "", qty: 1 }]);
            }}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          >
            <option value="">Select a vendor...</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {/* Direction Toggle */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Direction
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDirection("sent")}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                direction === "sent"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Sent to Vendor
            </button>
            <button
              type="button"
              onClick={() => setDirection("sold")}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                direction === "sold"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              Sold / Reported
            </button>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Line Items
            </label>
            <button
              type="button"
              onClick={addLineItem}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </button>
          </div>

          <div className="space-y-3">
            {lineItems.map((li, idx) => (
              <div
                key={li.id}
                className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    SKU
                  </label>
                  <select
                    value={li.sku_id}
                    onChange={(e) =>
                      updateLineItem(li.id, "sku_id", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                    required
                  >
                    <option value="">Select SKU...</option>
                    {availableSkus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sku_code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24 shrink-0">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Qty
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={li.qty}
                    onChange={(e) =>
                      updateLineItem(
                        li.id,
                        "qty",
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white tabular-nums"
                    required
                  />
                </div>
                <div className="pt-6">
                  <button
                    type="button"
                    onClick={() => removeLineItem(li.id)}
                    disabled={lineItems.length <= 1}
                    className={`p-1.5 rounded-lg transition-colors ${
                      lineItems.length <= 1
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Date & Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional notes about this replenishment..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                Log Replenishment
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push("/replenishment")}
            className="px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
