"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Vendor, Alert, AuditLog } from "@/lib/types";
import {
  Store,
  Package,
  DollarSign,
  AlertTriangle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface DashboardStats {
  totalVendors: number;
  totalSkus: number;
  totalStockValue: number;
  outstandingCommission: number;
}

interface AlertWithDetails extends Alert {
  vendor_name?: string;
  sku_code?: string;
}

interface VendorOverview {
  id: string;
  name: string;
  totalSkus: number;
  totalStockValue: number;
  lastCheckDate: string | null;
  status: "good" | "warning" | "critical";
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalVendors: 0,
    totalSkus: 0,
    totalStockValue: 0,
    outstandingCommission: 0,
  });
  const [alerts, setAlerts] = useState<AlertWithDetails[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [vendorOverview, setVendorOverview] = useState<VendorOverview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchAlerts(),
        fetchAuditLogs(),
        fetchVendorOverview(),
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    const [vendorsRes, skusRes, vendorSkusRes, settlementsRes] =
      await Promise.all([
        supabase.from("vendors").select("id", { count: "exact", head: true }),
        supabase.from("skus").select("id", { count: "exact", head: true }),
        supabase
          .from("vendor_skus")
          .select("current_expected_stock, sku_id, skus(retail_price)"),
        supabase
          .from("settlements")
          .select("total_owed, total_paid")
          .eq("status", "pending"),
      ]);

    const totalVendors = vendorsRes.count ?? 0;
    const totalSkus = skusRes.count ?? 0;

    let totalStockValue = 0;
    if (vendorSkusRes.data) {
      for (const vs of vendorSkusRes.data) {
        const sku = vs.skus as unknown as { retail_price: number } | null;
        const price = sku?.retail_price ?? 0;
        totalStockValue += vs.current_expected_stock * price;
      }
    }

    let outstandingCommission = 0;
    if (settlementsRes.data) {
      for (const s of settlementsRes.data) {
        outstandingCommission += s.total_owed - s.total_paid;
      }
    }

    setStats({ totalVendors, totalSkus, totalStockValue, outstandingCommission });
  }

  async function fetchAlerts() {
    const { data } = await supabase
      .from("alerts")
      .select("*, vendors(name), skus(sku_code)")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      const mapped: AlertWithDetails[] = data.map((a: Record<string, unknown>) => ({
        id: a.id as string,
        type: a.type as Alert["type"],
        vendor_id: a.vendor_id as string,
        sku_id: a.sku_id as string,
        message: a.message as string,
        resolved: a.resolved as boolean,
        created_at: a.created_at as string,
        vendor_name: (a.vendors as Record<string, unknown> | null)?.name as string | undefined,
        sku_code: (a.skus as Record<string, unknown> | null)?.sku_code as string | undefined,
      }));
      setAlerts(mapped);
    }
  }

  async function fetchAuditLogs() {
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setAuditLogs(data as AuditLog[]);
    }
  }

  async function fetchVendorOverview() {
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, name")
      .order("name");

    if (!vendors) return;

    const overviews: VendorOverview[] = [];

    for (const vendor of vendors as Vendor[]) {
      const [skuCountRes, stockRes, checkRes] = await Promise.all([
        supabase
          .from("vendor_skus")
          .select("id", { count: "exact", head: true })
          .eq("vendor_id", vendor.id),
        supabase
          .from("vendor_skus")
          .select("current_expected_stock, sku_id, skus(retail_price)")
          .eq("vendor_id", vendor.id),
        supabase
          .from("stock_checks")
          .select("check_date")
          .eq("vendor_id", vendor.id)
          .eq("status", "completed")
          .order("check_date", { ascending: false })
          .limit(1),
      ]);

      let totalStockValue = 0;
      if (stockRes.data) {
        for (const vs of stockRes.data) {
          const sku = vs.skus as unknown as { retail_price: number } | null;
          const price = sku?.retail_price ?? 0;
          totalStockValue += vs.current_expected_stock * price;
        }
      }

      const lastCheckDate =
        checkRes.data && checkRes.data.length > 0
          ? checkRes.data[0].check_date
          : null;

      let status: "good" | "warning" | "critical" = "good";
      if (!lastCheckDate) {
        status = "warning";
      } else {
        const daysSinceCheck = Math.floor(
          (Date.now() - new Date(lastCheckDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceCheck > 14) status = "critical";
        else if (daysSinceCheck > 7) status = "warning";
      }

      overviews.push({
        id: vendor.id,
        name: vendor.name,
        totalSkus: skuCountRes.count ?? 0,
        totalStockValue,
        lastCheckDate,
        status,
      });
    }

    setVendorOverview(overviews);
  }

  async function resolveAlert(alertId: string) {
    const { error } = await supabase
      .from("alerts")
      .update({ resolved: true })
      .eq("id", alertId);

    if (!error) {
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    }
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }

  const alertColorMap: Record<Alert["type"], { bg: string; border: string; icon: string }> = {
    discrepancy: {
      bg: "bg-red-50",
      border: "border-red-300",
      icon: "text-red-600",
    },
    low_stock: {
      bg: "bg-orange-50",
      border: "border-orange-300",
      icon: "text-orange-600",
    },
    shrinkage: {
      bg: "bg-yellow-50",
      border: "border-yellow-300",
      icon: "text-yellow-600",
    },
  };

  const statusIndicator: Record<string, { dot: string; label: string }> = {
    good: { dot: "bg-green-500", label: "Up to date" },
    warning: { dot: "bg-yellow-500", label: "Needs check" },
    critical: { dot: "bg-red-500", label: "Overdue" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Overview of your consignment operations
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Vendors</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {stats.totalVendors}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total SKUs</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {stats.totalSkus}
              </p>
            </div>
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Total Stock Value
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatCurrency(stats.totalStockValue)}
              </p>
            </div>
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Outstanding Commission
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatCurrency(stats.outstandingCommission)}
              </p>
            </div>
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Alerts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-900">Alerts</h2>
              {alerts.length > 0 && (
                <span className="ml-auto bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {alerts.length} unresolved
                </span>
              )}
            </div>
          </div>
          <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No unresolved alerts
              </p>
            ) : (
              alerts.map((alert) => {
                const colors = alertColorMap[alert.type];
                return (
                  <div
                    key={alert.id}
                    className={`${colors.bg} border ${colors.border} rounded-lg p-3`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs font-semibold uppercase ${colors.icon}`}
                          >
                            {alert.type.replace("_", " ")}
                          </span>
                          {alert.vendor_name && (
                            <span className="text-xs text-slate-500">
                              {alert.vendor_name}
                            </span>
                          )}
                          {alert.sku_code && (
                            <span className="text-xs font-mono text-slate-500 bg-white/60 px-1.5 py-0.5 rounded">
                              {alert.sku_code}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700">{alert.message}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatDistanceToNow(new Date(alert.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1 transition-colors shrink-0"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-700" />
              <h2 className="text-lg font-semibold text-slate-900">
                Recent Activity
              </h2>
            </div>
          </div>
          <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No recent activity
              </p>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0"
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">{log.action}</span>
                      {log.entity_type && (
                        <span className="text-slate-400">
                          {" "}
                          on {log.entity_type}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">
                        by {log.performed_by}
                      </span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-400">
                        {format(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Vendor Overview Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">
              Vendor Overview
            </h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">
                  Vendor
                </th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">
                  SKUs
                </th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">
                  Stock Value
                </th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">
                  Last Check
                </th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendorOverview.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-sm text-slate-400 text-center py-8 px-5"
                  >
                    No vendors found
                  </td>
                </tr>
              ) : (
                vendorOverview.map((vendor) => {
                  const si = statusIndicator[vendor.status];
                  return (
                    <tr
                      key={vendor.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <span className="text-sm font-medium text-slate-900">
                          {vendor.name}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-slate-600">
                          {vendor.totalSkus}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-slate-600">
                          {formatCurrency(vendor.totalStockValue)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-slate-600">
                          {vendor.lastCheckDate
                            ? format(
                                new Date(vendor.lastCheckDate),
                                "MMM d, yyyy"
                              )
                            : "Never"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${si.dot}`}
                          />
                          <span className="text-sm text-slate-600">
                            {si.label}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
