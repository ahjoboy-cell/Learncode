"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PurchaseOrder, Vendor } from "@/lib/types";
import {
  FileText,
  Plus,
  Search,
  Filter,
  ChevronRight,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  PackageCheck,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { exportToExcel, applyCurrencyColumns } from "@/lib/excel-export";
import { exportToCSV } from "@/lib/csv-utils";

interface PORow extends PurchaseOrder {
  vendor_name: string;
  item_count: number;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; bg: string; text: string }> = {
  draft: { label: "Draft", icon: FileText, bg: "bg-gray-50", text: "text-gray-600" },
  sent: { label: "Sent", icon: Send, bg: "bg-blue-50", text: "text-blue-700" },
  acknowledged: { label: "Acknowledged", icon: CheckCircle, bg: "bg-indigo-50", text: "text-indigo-700" },
  shipped: { label: "Shipped", icon: Truck, bg: "bg-amber-50", text: "text-amber-700" },
  received: { label: "Received", icon: PackageCheck, bg: "bg-emerald-50", text: "text-emerald-700" },
  cancelled: { label: "Cancelled", icon: XCircle, bg: "bg-red-50", text: "text-red-700" },
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PORow[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const [vendorRes, poRes] = await Promise.all([
      supabase.from("vendors").select("*").order("name"),
      supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }),
    ]);

    if (vendorRes.data) setVendors(vendorRes.data);

    if (poRes.data) {
      const vendorMap = new Map((vendorRes.data ?? []).map((v) => [v.id, v.name]));

      // Get item counts
      const poIds = poRes.data.map((po) => po.id);
      let itemCounts: Record<string, number> = {};
      if (poIds.length > 0) {
        const { data: items } = await supabase
          .from("purchase_order_items")
          .select("purchase_order_id");
        if (items) {
          for (const item of items) {
            itemCounts[item.purchase_order_id] = (itemCounts[item.purchase_order_id] || 0) + 1;
          }
        }
      }

      setOrders(
        poRes.data.map((po) => ({
          ...po,
          vendor_name: vendorMap.get(po.vendor_id) ?? "Unknown",
          item_count: itemCounts[po.id] || 0,
        }))
      );
    }

    setLoading(false);
  }

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        o.po_number.toLowerCase().includes(q) ||
        o.vendor_name.toLowerCase().includes(q);
      const matchesVendor = !vendorFilter || o.vendor_id === vendorFilter;
      const matchesStatus = !statusFilter || o.status === statusFilter;
      return matchesSearch && matchesVendor && matchesStatus;
    });
  }, [orders, search, vendorFilter, statusFilter]);

  const summary = useMemo(() => {
    const total = orders.length;
    const open = orders.filter((o) => !["received", "cancelled"].includes(o.status)).length;
    const totalValue = orders.reduce((sum, o) => sum + o.total_amount, 0);
    return { total, open, totalValue };
  }, [orders]);

  function handleExport(format: "xlsx" | "csv") {
    const data = filtered.map((o) => ({
      "PO Number": o.po_number,
      Vendor: o.vendor_name,
      "Order Date": o.order_date,
      "Expected Delivery": o.expected_delivery_date || "",
      Status: o.status,
      "Total Amount": o.total_amount,
      Items: o.item_count,
      Notes: o.notes || "",
    }));

    const fileName = `purchase_orders_${new Date().toISOString().slice(0, 10)}`;
    if (format === "xlsx") {
      exportToExcel(applyCurrencyColumns(data, ["Total Amount"]), "Purchase Orders", fileName);
    } else {
      exportToCSV(data, fileName);
    }
  }

  const hasActiveFilters = vendorFilter || statusFilter;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-sm text-gray-500">
              {summary.total} PO{summary.total !== 1 ? "s" : ""} &middot; {summary.open} open
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("xlsx")}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => router.push("/purchase-orders/new")}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New PO
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Total POs</p>
          <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Open Orders</p>
          <p className="text-2xl font-bold text-amber-600">{summary.open}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Total Value</p>
          <p className="text-2xl font-bold text-gray-900">
            ${summary.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by PO number or vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold flex items-center justify-center">
              {[vendorFilter, statusFilter].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Vendor</label>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Statuses</option>
                {Object.entries(statusConfig).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={() => { setVendorFilter(""); setStatusFilter(""); }}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading purchase orders...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No purchase orders found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search || hasActiveFilters ? "Try adjusting your search or filters" : "Create your first PO to get started"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">PO Number</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Order Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Expected Delivery</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Items</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((po) => {
                  const sc = statusConfig[po.status] || statusConfig.draft;
                  const StatusIcon = sc.icon;
                  return (
                    <tr
                      key={po.id}
                      onClick={() => router.push(`/purchase-orders/${po.id}`)}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                          {po.po_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{po.vendor_name}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {format(new Date(po.order_date), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {po.expected_delivery_date
                          ? format(new Date(po.expected_delivery_date), "MMM d, yyyy")
                          : "--"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{po.item_count}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                        ${po.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                          <StatusIcon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
