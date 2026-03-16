"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { VendorInvoice, Vendor } from "@/lib/types";
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Download,
  DollarSign,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { exportToExcel, applyCurrencyColumns } from "@/lib/excel-export";
import { exportToCSV } from "@/lib/csv-utils";

interface InvoiceRow extends VendorInvoice {
  vendor_name: string;
  po_number: string | null;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; bg: string; text: string }> = {
  pending: { label: "Pending", icon: Clock, bg: "bg-gray-50", text: "text-gray-600" },
  approved: { label: "Approved", icon: CheckCircle, bg: "bg-blue-50", text: "text-blue-700" },
  partially_paid: { label: "Partial", icon: DollarSign, bg: "bg-amber-50", text: "text-amber-700" },
  paid: { label: "Paid", icon: CheckCircle, bg: "bg-emerald-50", text: "text-emerald-700" },
  overdue: { label: "Overdue", icon: AlertTriangle, bg: "bg-red-50", text: "text-red-700" },
  cancelled: { label: "Cancelled", icon: XCircle, bg: "bg-gray-50", text: "text-gray-500" },
};

export default function VendorInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
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

    const [vendorRes, invRes] = await Promise.all([
      supabase.from("vendors").select("*").order("name"),
      supabase.from("vendor_invoices").select("*").order("created_at", { ascending: false }),
    ]);

    if (vendorRes.data) setVendors(vendorRes.data);

    if (invRes.data) {
      const vendorMap = new Map((vendorRes.data ?? []).map((v) => [v.id, v.name]));

      // Get PO numbers for linked invoices
      const poIds = invRes.data.filter((inv) => inv.purchase_order_id).map((inv) => inv.purchase_order_id);
      let poMap = new Map<string, string>();
      if (poIds.length > 0) {
        const { data: poData } = await supabase
          .from("purchase_orders")
          .select("id, po_number")
          .in("id", poIds);
        if (poData) {
          poMap = new Map(poData.map((p) => [p.id, p.po_number]));
        }
      }

      setInvoices(
        invRes.data.map((inv) => {
          // Auto-detect overdue
          let status = inv.status;
          if (status === "pending" || status === "approved") {
            if (isPast(parseISO(inv.due_date))) {
              status = "overdue";
            }
          }
          return {
            ...inv,
            status,
            vendor_name: vendorMap.get(inv.vendor_id) ?? "Unknown",
            po_number: inv.purchase_order_id ? poMap.get(inv.purchase_order_id) ?? null : null,
          };
        })
      );
    }

    setLoading(false);
  }

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.vendor_name.toLowerCase().includes(q) ||
        (inv.po_number && inv.po_number.toLowerCase().includes(q));
      const matchesVendor = !vendorFilter || inv.vendor_id === vendorFilter;
      const matchesStatus = !statusFilter || inv.status === statusFilter;
      return matchesSearch && matchesVendor && matchesStatus;
    });
  }, [invoices, search, vendorFilter, statusFilter]);

  const summary = useMemo(() => {
    const total = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const paid = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);
    const overdue = invoices.filter((inv) => inv.status === "overdue").length;
    return { total, paid, outstanding: total - paid, overdue };
  }, [invoices]);

  function handleExport(fmt: "xlsx" | "csv") {
    const data = filtered.map((inv) => ({
      "Invoice #": inv.invoice_number,
      Vendor: inv.vendor_name,
      "PO #": inv.po_number || "",
      "Invoice Date": inv.invoice_date,
      "Due Date": inv.due_date,
      Subtotal: inv.subtotal,
      Tax: inv.tax_amount,
      Total: inv.total_amount,
      Paid: inv.amount_paid,
      Balance: inv.total_amount - inv.amount_paid,
      Status: inv.status,
    }));

    const fileName = `vendor_invoices_${new Date().toISOString().slice(0, 10)}`;
    if (fmt === "xlsx") {
      exportToExcel(applyCurrencyColumns(data, ["Subtotal", "Tax", "Total", "Paid", "Balance"]), "Invoices", fileName);
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
            <FileSpreadsheet className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Invoices</h1>
            <p className="text-sm text-gray-500">Track and manage vendor invoices for payment</p>
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
            onClick={() => router.push("/vendor-invoices/new")}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Total Invoiced</p>
          <p className="text-2xl font-bold text-gray-900">
            ${summary.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-emerald-600">
            ${summary.paid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-amber-600">
            ${summary.outstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Overdue</p>
          <p className="text-2xl font-bold text-red-600">{summary.overdue}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by invoice #, vendor, or PO #..."
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
            <p className="text-sm text-gray-500">Loading invoices...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No invoices found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search || hasActiveFilters ? "Try adjusting your search or filters" : "Create your first invoice to get started"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Invoice #</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">PO #</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Invoice Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Due Date</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Balance</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((inv) => {
                  const sc = statusConfig[inv.status] || statusConfig.pending;
                  const StatusIcon = sc.icon;
                  const balance = inv.total_amount - inv.amount_paid;
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => router.push(`/vendor-invoices/${inv.id}`)}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                          {inv.invoice_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{inv.vendor_name}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {inv.po_number ? (
                          <span className="font-mono text-xs">{inv.po_number}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {format(new Date(inv.invoice_date), "MMM d, yyyy")}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap ${inv.status === "overdue" ? "text-red-600 font-medium" : "text-gray-700"}`}>
                        {format(new Date(inv.due_date), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                        ${inv.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                        ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
