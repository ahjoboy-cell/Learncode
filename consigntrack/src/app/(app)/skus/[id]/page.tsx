"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Sku, VendorSku } from "@/lib/types";
import {
  Package,
  ArrowLeft,
  DollarSign,
  Edit3,
  Save,
  X,
  TrendingUp,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ClipboardCheck,
  Users,
} from "lucide-react";
import { format } from "date-fns";

interface VendorSkuWithVendor extends VendorSku {
  vendor_name: string;
  last_counted: string | null;
  last_discrepancy: number | null;
}

interface MovementEvent {
  id: string;
  type: "sent" | "sold" | "stock_check";
  vendor_name: string;
  qty: number;
  date: string;
  notes: string | null;
}

export default function SkuDetailPage() {
  const params = useParams();
  const router = useRouter();
  const skuId = params.id as string;

  const [sku, setSku] = useState<Sku | null>(null);
  const [vendorStocks, setVendorStocks] = useState<VendorSkuWithVendor[]>([]);
  const [movements, setMovements] = useState<MovementEvent[]>([]);
  const [totalUnitsSold, setTotalUnitsSold] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    category: "",
    unit_cost: "",
    retail_price: "",
    commission_per_unit: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch SKU
      const { data: skuData, error: skuError } = await supabase
        .from("skus")
        .select("*")
        .eq("id", skuId)
        .single();

      if (skuError || !skuData) {
        router.replace("/skus");
        return;
      }
      setSku(skuData);
      setEditForm({
        name: skuData.name,
        description: skuData.description || "",
        category: skuData.category || "",
        unit_cost: String(skuData.unit_cost),
        retail_price: String(skuData.retail_price),
        commission_per_unit: String(skuData.commission_per_unit),
      });

      // Fetch vendor_skus with vendor names
      const { data: vsData } = await supabase
        .from("vendor_skus")
        .select("*, vendors(name)")
        .eq("sku_id", skuId);

      // Fetch latest stock check items for this SKU per vendor
      const { data: checkItems } = await supabase
        .from("stock_check_items")
        .select("*, stock_checks(vendor_id, check_date, status)")
        .eq("sku_id", skuId)
        .order("id", { ascending: false });

      // Build last-counted map by vendor
      const lastCountedMap: Record<string, { date: string; discrepancy: number }> = {};
      if (checkItems) {
        for (const item of checkItems) {
          const sc = item.stock_checks as unknown as { vendor_id: string; check_date: string; status: string };
          if (sc && sc.status === "completed" && !lastCountedMap[sc.vendor_id]) {
            lastCountedMap[sc.vendor_id] = {
              date: sc.check_date,
              discrepancy: item.discrepancy,
            };
          }
        }
      }

      const enrichedVs: VendorSkuWithVendor[] = (vsData || []).map((vs) => {
        const vendorObj = (vs as Record<string, unknown>).vendors as { name: string } | null;
        const lastCheck = lastCountedMap[vs.vendor_id];
        return {
          ...vs,
          vendor_name: vendorObj?.name || "Unknown",
          last_counted: lastCheck?.date || null,
          last_discrepancy: lastCheck?.discrepancy ?? null,
        };
      });
      setVendorStocks(enrichedVs);

      // Fetch replenishments for this SKU
      const { data: repData } = await supabase
        .from("replenishments")
        .select("*, vendors(name)")
        .eq("sku_id", skuId)
        .order("date", { ascending: false })
        .limit(50);

      // Fetch stock checks that include this SKU
      const { data: sciData } = await supabase
        .from("stock_check_items")
        .select("*, stock_checks(vendor_id, check_date, status, vendors(name))")
        .eq("sku_id", skuId)
        .order("id", { ascending: false })
        .limit(50);

      // Build movement timeline
      const events: MovementEvent[] = [];

      if (repData) {
        for (const r of repData) {
          const vendorObj = (r as Record<string, unknown>).vendors as { name: string } | null;
          events.push({
            id: r.id,
            type: r.direction as "sent" | "sold",
            vendor_name: vendorObj?.name || "Unknown",
            qty: r.qty,
            date: r.date,
            notes: r.notes,
          });
        }
      }

      if (sciData) {
        for (const sci of sciData) {
          const sc = sci.stock_checks as unknown as {
            vendor_id: string;
            check_date: string;
            status: string;
            vendors: { name: string } | null;
          };
          if (sc && sc.status === "completed") {
            events.push({
              id: sci.id,
              type: "stock_check",
              vendor_name: sc.vendors?.name || "Unknown",
              qty: sci.counted_qty,
              date: sc.check_date,
              notes: sci.discrepancy !== 0 ? `Discrepancy: ${sci.discrepancy}` : null,
            });
          }
        }
      }

      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMovements(events);

      // Total units sold (from sales table)
      const { data: salesData } = await supabase
        .from("sales")
        .select("qty_sold")
        .eq("sku_id", skuId);

      const totalSold = (salesData || []).reduce((sum, s) => sum + s.qty_sold, 0);
      setTotalUnitsSold(totalSold);
    } catch (err) {
      console.error("Error fetching SKU details:", err);
    } finally {
      setLoading(false);
    }
  }, [skuId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave() {
    if (!sku) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("skus")
        .update({
          name: editForm.name,
          description: editForm.description || null,
          category: editForm.category || null,
          unit_cost: parseFloat(editForm.unit_cost) || 0,
          retail_price: parseFloat(editForm.retail_price) || 0,
          commission_per_unit: parseFloat(editForm.commission_per_unit) || 0,
        })
        .eq("id", sku.id);

      if (error) throw error;
      setEditing(false);
      await fetchData();
    } catch (err) {
      console.error("Error updating SKU:", err);
    } finally {
      setSaving(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  const commissionEarned = useMemo(() => {
    if (!sku) return 0;
    return totalUnitsSold * sku.commission_per_unit;
  }, [totalUnitsSold, sku]);

  const totalStock = useMemo(() => {
    return vendorStocks.reduce((sum, vs) => sum + vs.current_expected_stock, 0);
  }, [vendorStocks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading SKU details...</p>
        </div>
      </div>
    );
  }

  if (!sku) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/skus")}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to SKU Catalog
      </button>

      {/* SKU Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
              <Package className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              {editing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="SKU Name"
                  />
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Description"
                    rows={2}
                  />
                  <input
                    type="text"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Category"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-gray-900">{sku.name}</h1>
                    <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded">
                      {sku.sku_code}
                    </span>
                  </div>
                  {sku.description && (
                    <p className="text-sm text-gray-500 mb-2">{sku.description}</p>
                  )}
                  {sku.category && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {sku.category}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pricing & Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Unit Cost */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Unit Cost</span>
          </div>
          {editing ? (
            <input
              type="number"
              step="0.01"
              value={editForm.unit_cost}
              onChange={(e) => setEditForm({ ...editForm, unit_cost: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(sku.unit_cost)}</p>
          )}
        </div>

        {/* Retail Price */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Retail Price</span>
          </div>
          {editing ? (
            <input
              type="number"
              step="0.01"
              value={editForm.retail_price}
              onChange={(e) => setEditForm({ ...editForm, retail_price: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(sku.retail_price)}</p>
          )}
        </div>

        {/* Commission Per Unit */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Commission/Unit</span>
          </div>
          {editing ? (
            <input
              type="number"
              step="0.01"
              value={editForm.commission_per_unit}
              onChange={(e) => setEditForm({ ...editForm, commission_per_unit: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(sku.commission_per_unit)}</p>
          )}
        </div>

        {/* Commission Earned */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Commission Earned</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(commissionEarned)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {totalUnitsSold} unit{totalUnitsSold !== 1 ? "s" : ""} sold
          </p>
        </div>
      </div>

      {/* Stock by Vendor */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-gray-900">Stock by Vendor</h2>
            <span className="ml-auto text-sm font-medium text-gray-500">
              Total: <span className="text-gray-900 font-bold">{totalStock}</span> units
            </span>
          </div>
        </div>
        {vendorStocks.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">This SKU is not assigned to any vendor yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Vendor</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Expected Stock</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Last Counted</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Discrepancy</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Min Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendorStocks.map((vs) => (
                  <tr key={vs.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{vs.vendor_name}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          vs.current_expected_stock < vs.min_stock_level
                            ? "text-red-600"
                            : "text-gray-900"
                        }`}
                      >
                        {vs.current_expected_stock}
                      </span>
                      {vs.current_expected_stock < vs.min_stock_level && (
                        <span className="ml-1.5 text-xs text-red-500 font-medium">Low</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {vs.last_counted
                        ? format(new Date(vs.last_counted), "MMM d, yyyy")
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {vs.last_discrepancy !== null ? (
                        <span
                          className={`font-medium ${
                            vs.last_discrepancy === 0
                              ? "text-green-600"
                              : vs.last_discrepancy > 0
                              ? "text-red-600"
                              : "text-amber-600"
                          }`}
                        >
                          {vs.last_discrepancy === 0
                            ? "None"
                            : vs.last_discrepancy > 0
                            ? `+${vs.last_discrepancy}`
                            : vs.last_discrepancy}
                        </span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{vs.min_stock_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Movement History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-gray-900">Movement History</h2>
          </div>
        </div>
        {movements.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">No movement history for this SKU yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {movements.map((event) => (
              <div key={`${event.type}-${event.id}`} className="px-6 py-4 flex items-center gap-4">
                {/* Icon */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    event.type === "sent"
                      ? "bg-blue-50"
                      : event.type === "sold"
                      ? "bg-green-50"
                      : "bg-amber-50"
                  }`}
                >
                  {event.type === "sent" ? (
                    <ArrowUpRight className="w-4 h-4 text-blue-600" />
                  ) : event.type === "sold" ? (
                    <ArrowDownRight className="w-4 h-4 text-green-600" />
                  ) : (
                    <ClipboardCheck className="w-4 h-4 text-amber-600" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {event.type === "sent"
                      ? "Sent to vendor"
                      : event.type === "sold"
                      ? "Sold"
                      : "Stock check"}
                    <span className="text-gray-500 font-normal"> at </span>
                    <span className="font-medium">{event.vendor_name}</span>
                  </p>
                  {event.notes && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{event.notes}</p>
                  )}
                </div>

                {/* Quantity */}
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-semibold ${
                      event.type === "sent"
                        ? "text-blue-600"
                        : event.type === "sold"
                        ? "text-green-600"
                        : "text-gray-700"
                    }`}
                  >
                    {event.type === "sent" ? "+" : event.type === "sold" ? "-" : ""}
                    {event.qty} units
                  </p>
                  <p className="text-xs text-gray-400">
                    {format(new Date(event.date), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
