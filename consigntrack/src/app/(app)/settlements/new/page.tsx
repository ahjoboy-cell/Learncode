"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Vendor } from "@/lib/types";
import {
  DollarSign,
  CheckCircle,
  FileText,
  Plus,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface LineItem {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  qty: number;
  commission_per_unit: number;
  line_total: number;
}

export default function NewSettlementPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculated, setCalculated] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  async function fetchVendors() {
    const { data } = await supabase
      .from("vendors")
      .select("*")
      .order("name");
    if (data) setVendors(data);
  }

  async function calculateSettlement() {
    if (!selectedVendor || !periodStart || !periodEnd) return;

    setCalculating(true);
    setLineItems([]);
    setGrandTotal(0);
    setCalculated(false);

    try {
      // Fetch all replenishments with direction='sold' for this vendor in the date range
      const { data: repData, error: repError } = await supabase
        .from("replenishments")
        .select("sku_id, qty")
        .eq("vendor_id", selectedVendor)
        .eq("direction", "sold")
        .gte("date", periodStart)
        .lte("date", periodEnd);

      if (repError) throw repError;

      if (!repData || repData.length === 0) {
        setCalculated(true);
        setCalculating(false);
        return;
      }

      // Aggregate qty per SKU
      const skuQtyMap: Record<string, number> = {};
      for (const r of repData) {
        skuQtyMap[r.sku_id] = (skuQtyMap[r.sku_id] || 0) + r.qty;
      }

      const skuIds = Object.keys(skuQtyMap);

      // Fetch SKU details
      const { data: skuData } = await supabase
        .from("skus")
        .select("id, sku_code, name, commission_per_unit")
        .in("id", skuIds);

      const items: LineItem[] = (skuData ?? []).map((sku) => {
        const qty = skuQtyMap[sku.id] || 0;
        const lineTotal = qty * sku.commission_per_unit;
        return {
          sku_id: sku.id,
          sku_code: sku.sku_code,
          sku_name: sku.name,
          qty,
          commission_per_unit: sku.commission_per_unit,
          line_total: lineTotal,
        };
      });

      items.sort((a, b) => a.sku_code.localeCompare(b.sku_code));

      const total = items.reduce((sum, item) => sum + item.line_total, 0);

      setLineItems(items);
      setGrandTotal(total);
      setCalculated(true);
    } catch (err) {
      console.error("Error calculating settlement:", err);
    } finally {
      setCalculating(false);
    }
  }

  async function saveSettlement() {
    if (!selectedVendor || !periodStart || !periodEnd || grandTotal <= 0) return;

    setSaving(true);

    try {
      const { data: settlement, error } = await supabase
        .from("settlements")
        .insert({
          vendor_id: selectedVendor,
          period_start: periodStart,
          period_end: periodEnd,
          total_owed: grandTotal,
          total_paid: 0,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Insert settlement line items if the table exists
      if (settlement && lineItems.length > 0) {
        const lineItemRows = lineItems.map((item) => ({
          settlement_id: settlement.id,
          sku_id: item.sku_id,
          qty: item.qty,
          commission_per_unit: item.commission_per_unit,
          line_total: item.line_total,
        }));

        await supabase.from("settlement_items").insert(lineItemRows);
      }

      router.push(`/settlements/${settlement.id}`);
    } catch (err) {
      console.error("Error saving settlement:", err);
      alert("Failed to save settlement. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const canCalculate = selectedVendor && periodStart && periodEnd;
  const selectedVendorName = vendors.find((v) => v.id === selectedVendor)?.name;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/settlements")}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Create Settlement
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate a commission settlement for a vendor
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="space-y-4">
          {/* Vendor Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor
            </label>
            <select
              value={selectedVendor}
              onChange={(e) => {
                setSelectedVendor(e.target.value);
                setCalculated(false);
                setLineItems([]);
                setGrandTotal(0);
              }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select a vendor...</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period Start
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => {
                  setPeriodStart(e.target.value);
                  setCalculated(false);
                  setLineItems([]);
                  setGrandTotal(0);
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period End
              </label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => {
                  setPeriodEnd(e.target.value);
                  setCalculated(false);
                  setLineItems([]);
                  setGrandTotal(0);
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Calculate Button */}
          <button
            onClick={calculateSettlement}
            disabled={!canCalculate || calculating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {calculating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <DollarSign className="w-4 h-4" />
                Calculate Commission
              </>
            )}
          </button>
        </div>
      </div>

      {/* Line Items Breakdown */}
      {calculated && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              Commission Breakdown
            </h2>
            {selectedVendorName && (
              <p className="text-sm text-gray-500 mt-0.5">
                {selectedVendorName} &middot;{" "}
                {format(new Date(periodStart), "MMM d, yyyy")} &ndash;{" "}
                {format(new Date(periodEnd), "MMM d, yyyy")}
              </p>
            )}
          </div>

          {lineItems.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No sold items found</p>
              <p className="text-sm text-gray-400 mt-1">
                No replenishments with direction &quot;sold&quot; were found for
                this vendor in the selected period.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-slate-50">
                      <th className="text-left px-4 py-3 font-medium text-slate-600">
                        SKU Code
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">
                        SKU Name
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">
                        Qty Sold
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">
                        Commission/Unit
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-slate-600">
                        Line Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lineItems.map((item) => (
                      <tr
                        key={item.sku_id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                          {item.sku_code}
                        </td>
                        <td className="px-4 py-3 text-gray-900">
                          {item.sku_name}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-semibold tabular-nums">
                          {item.qty}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                          $
                          {item.commission_per_unit.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-semibold tabular-nums">
                          $
                          {item.line_total.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Grand Total */}
              <div className="px-4 py-4 border-t border-gray-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-gray-900">
                    Grand Total
                  </span>
                  <span className="text-xl font-bold text-gray-900">
                    $
                    {grandTotal.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Save Button */}
              <div className="px-4 py-4 border-t border-gray-100 flex justify-end">
                <button
                  onClick={saveSettlement}
                  disabled={saving || grandTotal <= 0}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Save Settlement
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
