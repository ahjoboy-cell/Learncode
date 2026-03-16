"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Vendor } from "@/lib/types";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Package,
  Plus,
  Filter,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";

interface ReplenishmentRow {
  id: string;
  vendor_id: string;
  sku_id: string;
  qty: number;
  direction: "sent" | "sold";
  date: string;
  logged_by: string;
  notes: string;
  created_at: string;
  vendor_name: string;
  sku_code: string;
  sku_name: string;
  logged_by_name: string;
}

interface ReconciliationRow {
  vendor_id: string;
  vendor_name: string;
  total_sent: number;
  total_sold: number;
  last_counted_stock: number | null;
  expected_stock: number;
  discrepancy: number;
}

type TabFilter = "all" | "sent" | "sold";

export default function ReplenishmentPage() {
  const [logs, setLogs] = useState<ReplenishmentRow[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [reconciliation, setReconciliation] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchData();
  }, [vendorFilter, dateFrom, dateTo]);

  async function fetchData() {
    setLoading(true);

    // Fetch vendors for filter dropdown
    const { data: vendorData } = await supabase
      .from("vendors")
      .select("*")
      .order("name");
    if (vendorData) setVendors(vendorData);

    // Build replenishments query
    let query = supabase
      .from("replenishments")
      .select("*")
      .order("date", { ascending: false });

    if (vendorFilter) {
      query = query.eq("vendor_id", vendorFilter);
    }
    if (dateFrom) {
      query = query.gte("date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("date", dateTo);
    }

    const { data: repData } = await query;

    if (repData && repData.length > 0) {
      const vendorIds = [...new Set(repData.map((r) => r.vendor_id))];
      const skuIds = [...new Set(repData.map((r) => r.sku_id))];
      const memberIds = [...new Set(repData.map((r) => r.logged_by))];

      const [vendorsRes, skusRes, membersRes] = await Promise.all([
        supabase.from("vendors").select("id, name").in("id", vendorIds),
        supabase.from("skus").select("id, sku_code, name").in("id", skuIds),
        supabase.from("team_members").select("id, name").in("id", memberIds),
      ]);

      const vendorMap = new Map(
        (vendorsRes.data ?? []).map((v) => [v.id, v.name])
      );
      const skuMap = new Map(
        (skusRes.data ?? []).map((s) => [s.id, { code: s.sku_code, name: s.name }])
      );
      const memberMap = new Map(
        (membersRes.data ?? []).map((m) => [m.id, m.name])
      );

      const enriched: ReplenishmentRow[] = repData.map((r) => ({
        ...r,
        vendor_name: vendorMap.get(r.vendor_id) ?? "Unknown",
        sku_code: skuMap.get(r.sku_id)?.code ?? "—",
        sku_name: skuMap.get(r.sku_id)?.name ?? "Unknown",
        logged_by_name: memberMap.get(r.logged_by) ?? "Unknown",
      }));

      setLogs(enriched);
    } else {
      setLogs([]);
    }

    // Fetch reconciliation data
    await fetchReconciliation(vendorData ?? []);

    setLoading(false);
  }

  async function fetchReconciliation(vendorList: Vendor[]) {
    // Get all replenishments grouped by vendor
    const { data: allReps } = await supabase
      .from("replenishments")
      .select("vendor_id, qty, direction");

    // Get latest completed stock checks per vendor
    const { data: stockChecks } = await supabase
      .from("stock_checks")
      .select("id, vendor_id, check_date")
      .eq("status", "completed")
      .order("check_date", { ascending: false });

    // Get stock check items for counted totals
    const checkIds = (stockChecks ?? []).map((sc) => sc.id);
    const { data: checkItems } = checkIds.length > 0
      ? await supabase
          .from("stock_check_items")
          .select("stock_check_id, counted_qty")
          .in("stock_check_id", checkIds)
      : { data: [] };

    // Build per-vendor totals
    const sentMap: Record<string, number> = {};
    const soldMap: Record<string, number> = {};

    for (const r of allReps ?? []) {
      if (r.direction === "sent") {
        sentMap[r.vendor_id] = (sentMap[r.vendor_id] || 0) + r.qty;
      } else {
        soldMap[r.vendor_id] = (soldMap[r.vendor_id] || 0) + r.qty;
      }
    }

    // Latest stock check per vendor
    const latestCheckMap: Record<string, string> = {};
    for (const sc of stockChecks ?? []) {
      if (!latestCheckMap[sc.vendor_id]) {
        latestCheckMap[sc.vendor_id] = sc.id;
      }
    }

    // Sum counted qty per stock check
    const countedMap: Record<string, number> = {};
    for (const item of checkItems ?? []) {
      countedMap[item.stock_check_id] =
        (countedMap[item.stock_check_id] || 0) + item.counted_qty;
    }

    const rows: ReconciliationRow[] = vendorList
      .map((v) => {
        const totalSent = sentMap[v.id] || 0;
        const totalSold = soldMap[v.id] || 0;
        const latestCheckId = latestCheckMap[v.id];
        const lastCounted = latestCheckId != null ? (countedMap[latestCheckId] ?? 0) : null;
        const expectedStock = totalSent - totalSold;
        const discrepancy =
          lastCounted !== null ? lastCounted - expectedStock : 0;

        return {
          vendor_id: v.id,
          vendor_name: v.name,
          total_sent: totalSent,
          total_sold: totalSold,
          last_counted_stock: lastCounted,
          expected_stock: expectedStock,
          discrepancy,
        };
      })
      .filter((r) => r.total_sent > 0 || r.total_sold > 0 || r.last_counted_stock !== null);

    setReconciliation(rows);
  }

  const filtered = useMemo(() => {
    if (activeTab === "all") return logs;
    return logs.filter((l) => l.direction === activeTab);
  }, [logs, activeTab]);

  function clearFilters() {
    setVendorFilter("");
    setDateFrom("");
    setDateTo("");
  }

  const hasActiveFilters = vendorFilter || dateFrom || dateTo;

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "sent", label: "Sent to Vendor" },
    { key: "sold", label: "Sold/Reported" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Replenishment</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track stock sent to vendors and sales reported
          </p>
        </div>
        <Link
          href="/replenishment/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Log Replenishment
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            Filters
            {hasActiveFilters && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
                {[vendorFilter, dateFrom, dateTo].filter(Boolean).length}
              </span>
            )}
          </div>
          <ChevronRight
            className={`w-4 h-4 text-gray-400 transition-transform ${
              showFilters ? "rotate-90" : ""
            }`}
          />
        </button>

        {showFilters && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Vendor
              </label>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Replenishment Log Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading replenishments...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No replenishment logs found</p>
          <p className="text-sm text-gray-400 mt-1">
            {hasActiveFilters || activeTab !== "all"
              ? "Try adjusting your filters or tab selection"
              : "Log your first replenishment to start tracking"}
          </p>
          {!hasActiveFilters && activeTab === "all" && (
            <Link
              href="/replenishment/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Log Replenishment
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Vendor
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    SKU Code
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    SKU Name
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    Qty
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">
                    Direction
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Logged By
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                      {format(new Date(log.date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {log.vendor_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {log.sku_code}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {log.sku_name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-semibold tabular-nums">
                      {log.qty}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {log.direction === "sent" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          <ArrowUpRight className="w-3 h-3" />
                          Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          <ArrowDownLeft className="w-3 h-3" />
                          Sold
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {log.logged_by_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                      {log.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reconciliation Section */}
      {!loading && reconciliation.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-bold text-gray-900">
              Reconciliation Overview
            </h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Per-vendor comparison of total sent, total sold, and last counted stock
          </p>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      Vendor
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      Total Sent
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      Total Sold
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      Expected Stock
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      Last Counted
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      Discrepancy
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reconciliation.map((row) => (
                    <tr
                      key={row.vendor_id}
                      className={`transition-colors ${
                        row.discrepancy !== 0 && row.last_counted_stock !== null
                          ? "bg-red-50/40 hover:bg-red-50/70"
                          : "hover:bg-slate-50/50"
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {row.vendor_name}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="inline-flex items-center gap-1 text-blue-700">
                          <ArrowUpRight className="w-3 h-3" />
                          {row.total_sent}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <ArrowDownLeft className="w-3 h-3" />
                          {row.total_sold}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-semibold tabular-nums">
                        {row.expected_stock}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        {row.last_counted_stock !== null
                          ? row.last_counted_stock
                          : "No count"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.last_counted_stock === null ? (
                          <span className="text-gray-400 text-xs">N/A</span>
                        ) : row.discrepancy === 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Matched
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            {row.discrepancy > 0 ? "+" : ""}
                            {row.discrepancy}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
