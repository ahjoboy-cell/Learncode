"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Vendor, Sku, Replenishment, StockCheck, StockCheckItem } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import {
  Store,
  MapPin,
  Phone,
  Mail,
  User,
  ArrowLeft,
  Pencil,
  X,
  Check,
  Package,
  RefreshCw,
  ClipboardCheck,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

type TabKey = "stock" | "replenishments" | "checks" | "commission";

interface VendorSkuRow {
  id: string;
  vendor_id: string;
  sku_id: string;
  min_stock_level: number;
  current_expected_stock: number;
  skus: {
    sku_code: string;
    name: string;
    retail_price: number;
  };
}

interface StockCheckWithItems extends StockCheck {
  total_discrepancies: number;
  checked_by_name?: string;
}

interface ReplenishmentRow extends Replenishment {
  sku_name?: string;
  sku_code?: string;
  logged_by_name?: string;
}

interface CommissionSummary {
  total_sold_qty: number;
  total_revenue: number;
  total_commission: number;
  outstanding: number;
}

interface LastCountMap {
  [skuId: string]: { counted_qty: number; check_date: string };
}

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const vendorId = params.id as string;

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("stock");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Vendor>>({});
  const [saving, setSaving] = useState(false);

  // Data sections
  const [vendorSkus, setVendorSkus] = useState<VendorSkuRow[]>([]);
  const [lastCounts, setLastCounts] = useState<LastCountMap>({});
  const [replenishments, setReplenishments] = useState<ReplenishmentRow[]>([]);
  const [stockChecks, setStockChecks] = useState<StockCheckWithItems[]>([]);
  const [commission, setCommission] = useState<CommissionSummary>({
    total_sold_qty: 0,
    total_revenue: 0,
    total_commission: 0,
    outstanding: 0,
  });

  const fetchVendor = useCallback(async () => {
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .single();

    if (error || !data) {
      router.push("/vendors");
      return;
    }
    setVendor(data as Vendor);
  }, [vendorId, router]);

  const fetchStockLevels = useCallback(async () => {
    // Fetch vendor_skus with sku details
    const { data: vsData } = await supabase
      .from("vendor_skus")
      .select("*, skus(sku_code, name, retail_price)")
      .eq("vendor_id", vendorId);

    if (vsData) {
      setVendorSkus(vsData as unknown as VendorSkuRow[]);
    }

    // Fetch last counted qty per SKU from the most recent completed stock check
    const { data: latestCheck } = await supabase
      .from("stock_checks")
      .select("id, check_date")
      .eq("vendor_id", vendorId)
      .eq("status", "completed")
      .order("check_date", { ascending: false })
      .limit(1);

    if (latestCheck && latestCheck.length > 0) {
      const { data: items } = await supabase
        .from("stock_check_items")
        .select("sku_id, counted_qty")
        .eq("stock_check_id", latestCheck[0].id);

      if (items) {
        const map: LastCountMap = {};
        for (const item of items) {
          map[item.sku_id] = {
            counted_qty: item.counted_qty,
            check_date: latestCheck[0].check_date,
          };
        }
        setLastCounts(map);
      }
    }
  }, [vendorId]);

  const fetchReplenishments = useCallback(async () => {
    const { data } = await supabase
      .from("replenishments")
      .select("*, skus(sku_code, name), team_members(name)")
      .eq("vendor_id", vendorId)
      .order("date", { ascending: false })
      .limit(50);

    if (data) {
      const mapped: ReplenishmentRow[] = data.map((r: Record<string, unknown>) => ({
        ...(r as Replenishment),
        sku_code: (r.skus as Record<string, unknown> | null)?.sku_code as string | undefined,
        sku_name: (r.skus as Record<string, unknown> | null)?.name as string | undefined,
        logged_by_name: (r.team_members as Record<string, unknown> | null)?.name as string | undefined,
      }));
      setReplenishments(mapped);
    }
  }, [vendorId]);

  const fetchStockChecks = useCallback(async () => {
    const { data } = await supabase
      .from("stock_checks")
      .select("*, team_members(name)")
      .eq("vendor_id", vendorId)
      .order("check_date", { ascending: false })
      .limit(50);

    if (!data) return;

    const checksWithItems: StockCheckWithItems[] = [];

    for (const check of data) {
      const { data: items } = await supabase
        .from("stock_check_items")
        .select("discrepancy")
        .eq("stock_check_id", check.id);

      const totalDisc = items
        ? items.reduce((sum: number, i: StockCheckItem) => sum + Math.abs(i.discrepancy), 0)
        : 0;

      checksWithItems.push({
        ...(check as StockCheck),
        total_discrepancies: totalDisc,
        checked_by_name: (check.team_members as Record<string, unknown> | null)?.name as string | undefined,
      });
    }

    setStockChecks(checksWithItems);
  }, [vendorId]);

  const fetchCommission = useCallback(async () => {
    const { data: sales } = await supabase
      .from("sales")
      .select("qty_sold, sale_price, commission_amount")
      .eq("vendor_id", vendorId);

    const { data: settlements } = await supabase
      .from("settlements")
      .select("total_owed, total_paid")
      .eq("vendor_id", vendorId);

    let total_sold_qty = 0;
    let total_revenue = 0;
    let total_commission = 0;

    if (sales) {
      for (const s of sales) {
        total_sold_qty += s.qty_sold;
        total_revenue += s.sale_price * s.qty_sold;
        total_commission += s.commission_amount;
      }
    }

    let totalOwed = 0;
    let totalPaid = 0;
    if (settlements) {
      for (const s of settlements) {
        totalOwed += s.total_owed;
        totalPaid += s.total_paid;
      }
    }

    setCommission({
      total_sold_qty,
      total_revenue,
      total_commission,
      outstanding: totalOwed - totalPaid,
    });
  }, [vendorId]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await fetchVendor();
      await Promise.all([
        fetchStockLevels(),
        fetchReplenishments(),
        fetchStockChecks(),
        fetchCommission(),
      ]);
      setLoading(false);
    }
    loadAll();
  }, [fetchVendor, fetchStockLevels, fetchReplenishments, fetchStockChecks, fetchCommission]);

  function startEditing() {
    if (!vendor) return;
    setEditForm({
      name: vendor.name,
      address: vendor.address,
      contact_person: vendor.contact_person,
      phone: vendor.phone,
      email: vendor.email,
      notes: vendor.notes,
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!vendor) return;
    setSaving(true);
    const { error } = await supabase
      .from("vendors")
      .update({
        name: editForm.name,
        address: editForm.address,
        contact_person: editForm.contact_person,
        phone: editForm.phone,
        email: editForm.email,
        notes: editForm.notes,
      })
      .eq("id", vendor.id);

    if (!error) {
      setVendor({ ...vendor, ...editForm } as Vendor);
      setEditing(false);
    }
    setSaving(false);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "stock", label: "Stock Levels", icon: <Package className="w-4 h-4" /> },
    { key: "replenishments", label: "Replenishments", icon: <RefreshCw className="w-4 h-4" /> },
    { key: "checks", label: "Stock Checks", icon: <ClipboardCheck className="w-4 h-4" /> },
    { key: "commission", label: "Commission", icon: <DollarSign className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading vendor...</p>
        </div>
      </div>
    );
  }

  if (!vendor) return null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.push("/vendors")}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Vendors
      </button>

      {/* Vendor Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
        {editing ? (
          /* Inline Edit Form */
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Edit Vendor</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving || !editForm.name?.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={editForm.contact_person || ""}
                  onChange={(e) => setEditForm({ ...editForm, contact_person: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editForm.address || ""}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editForm.phone || ""}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
        ) : (
          /* Display Mode */
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                  <Store className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{vendor.name}</h1>
                  {vendor.contact_person && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      <User className="w-3.5 h-3.5 inline mr-1" />
                      {vendor.contact_person}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={startEditing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {vendor.address && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {vendor.address}
                </div>
              )}
              {vendor.phone && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {vendor.phone}
                </div>
              )}
              {vendor.email && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {vendor.email}
                </div>
              )}
            </div>
            {vendor.notes && (
              <p className="mt-3 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                {vendor.notes}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "stock" && (
        <StockLevelsTab
          vendorSkus={vendorSkus}
          lastCounts={lastCounts}
          formatCurrency={formatCurrency}
        />
      )}
      {activeTab === "replenishments" && (
        <ReplenishmentsTab replenishments={replenishments} />
      )}
      {activeTab === "checks" && (
        <StockChecksTab stockChecks={stockChecks} />
      )}
      {activeTab === "commission" && (
        <CommissionTab commission={commission} formatCurrency={formatCurrency} />
      )}
    </div>
  );
}

/* ─── Stock Levels Tab ─── */
function StockLevelsTab({
  vendorSkus,
  lastCounts,
  formatCurrency,
}: {
  vendorSkus: VendorSkuRow[];
  lastCounts: LastCountMap;
  formatCurrency: (v: number) => string;
}) {
  if (vendorSkus.length === 0) {
    return (
      <div className="text-center py-16">
        <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No SKUs assigned to this vendor yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                SKU
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Name
              </th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Expected
              </th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Last Count
              </th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Discrepancy
              </th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Min Level
              </th>
              <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vendorSkus.map((vs) => {
              const lastCount = lastCounts[vs.sku_id];
              const countedQty = lastCount?.counted_qty ?? null;
              const discrepancy = countedQty !== null ? countedQty - vs.current_expected_stock : null;
              const isLowStock = vs.current_expected_stock <= vs.min_stock_level;
              const hasDiscrepancy = discrepancy !== null && discrepancy !== 0;

              let statusColor = "bg-green-100 text-green-700";
              let statusLabel = "OK";

              if (isLowStock && hasDiscrepancy) {
                statusColor = "bg-red-100 text-red-700";
                statusLabel = "Low + Discrepancy";
              } else if (hasDiscrepancy) {
                statusColor = "bg-orange-100 text-orange-700";
                statusLabel = "Discrepancy";
              } else if (isLowStock) {
                statusColor = "bg-yellow-100 text-yellow-700";
                statusLabel = "Low Stock";
              }

              return (
                <tr key={vs.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="text-sm font-mono text-gray-700">{vs.skus.sku_code}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-900">{vs.skus.name}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-sm font-medium text-gray-900">{vs.current_expected_stock}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-sm text-gray-600">
                      {countedQty !== null ? countedQty : "--"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {discrepancy !== null ? (
                      <span
                        className={`text-sm font-medium ${
                          discrepancy === 0
                            ? "text-green-600"
                            : discrepancy < 0
                            ? "text-red-600"
                            : "text-orange-600"
                        }`}
                      >
                        {discrepancy > 0 ? "+" : ""}
                        {discrepancy}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="text-sm text-gray-600">{vs.min_stock_level}</span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Replenishments Tab ─── */
function ReplenishmentsTab({ replenishments }: { replenishments: ReplenishmentRow[] }) {
  if (replenishments.length === 0) {
    return (
      <div className="text-center py-16">
        <RefreshCw className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No replenishment history yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Date
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                SKU
              </th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Qty
              </th>
              <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Direction
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Logged By
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {replenishments.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <span className="text-sm text-gray-900">
                    {format(new Date(r.date), "MMM d, yyyy")}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div>
                    <span className="text-sm font-mono text-gray-700">{r.sku_code}</span>
                    {r.sku_name && (
                      <p className="text-xs text-gray-400">{r.sku_name}</p>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className="text-sm font-medium text-gray-900">{r.qty}</span>
                </td>
                <td className="px-5 py-3 text-center">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                      r.direction === "sent"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {r.direction === "sent" ? "Sent" : "Sold"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className="text-sm text-gray-600">{r.logged_by_name || r.logged_by}</span>
                </td>
                <td className="px-5 py-3">
                  <span className="text-sm text-gray-500 truncate max-w-xs block">
                    {r.notes || "--"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Stock Checks Tab ─── */
function StockChecksTab({ stockChecks }: { stockChecks: StockCheckWithItems[] }) {
  if (stockChecks.length === 0) {
    return (
      <div className="text-center py-16">
        <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No stock checks performed yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Date
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Checked By
              </th>
              <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Status
              </th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Total Discrepancies
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stockChecks.map((check) => (
              <tr key={check.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <span className="text-sm text-gray-900">
                    {format(new Date(check.check_date), "MMM d, yyyy")}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className="text-sm text-gray-600">
                    {check.checked_by_name || check.checked_by}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                      check.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {check.status === "completed" ? "Completed" : "In Progress"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {check.total_discrepancies > 0 ? (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {check.total_discrepancies}
                    </span>
                  ) : (
                    <span className="text-sm text-green-600 font-medium">0</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className="text-sm text-gray-500 truncate max-w-xs block">
                    {check.notes || "--"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Commission Tab ─── */
function CommissionTab({
  commission,
  formatCurrency,
}: {
  commission: CommissionSummary;
  formatCurrency: (v: number) => string;
}) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Units Sold</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {commission.total_sold_qty.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(commission.total_revenue)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Commission Earned</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {formatCurrency(commission.total_commission)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Outstanding</p>
          <p className={`text-2xl font-bold mt-1 ${commission.outstanding > 0 ? "text-orange-600" : "text-gray-900"}`}>
            {formatCurrency(commission.outstanding)}
          </p>
        </div>
      </div>

      {commission.total_sold_qty === 0 && (
        <div className="text-center py-10">
          <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No sales recorded for this vendor yet.</p>
        </div>
      )}
    </div>
  );
}
