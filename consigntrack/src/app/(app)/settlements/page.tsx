"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Vendor, Settlement } from "@/lib/types";
import {
  DollarSign,
  CheckCircle,
  Clock,
  FileText,
  Plus,
  Filter,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

interface SettlementRow extends Settlement {
  vendor_name: string;
  total_sold_qty: number;
}

export default function SettlementsPage() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  const [vendorFilter, setVendorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "pending" | "paid">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchData();
  }, [vendorFilter, statusFilter, dateFrom, dateTo]);

  async function fetchData() {
    setLoading(true);

    // Fetch vendors for filter dropdown
    const { data: vendorData } = await supabase
      .from("vendors")
      .select("*")
      .order("name");
    if (vendorData) setVendors(vendorData);

    // Build settlements query
    let query = supabase
      .from("settlements")
      .select("*")
      .order("created_at", { ascending: false });

    if (vendorFilter) {
      query = query.eq("vendor_id", vendorFilter);
    }
    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }
    if (dateFrom) {
      query = query.gte("period_start", dateFrom);
    }
    if (dateTo) {
      query = query.lte("period_end", dateTo);
    }

    const { data: settData } = await query;

    if (settData && settData.length > 0) {
      const vendorIds = [...new Set(settData.map((s) => s.vendor_id))];

      const { data: vendorRows } = await supabase
        .from("vendors")
        .select("id, name")
        .in("id", vendorIds);

      const vendorMap = new Map(
        (vendorRows ?? []).map((v) => [v.id, v.name])
      );

      // Fetch sold qty per settlement period from replenishments
      const enriched: SettlementRow[] = [];

      for (const s of settData) {
        const { data: repRows } = await supabase
          .from("replenishments")
          .select("qty")
          .eq("vendor_id", s.vendor_id)
          .eq("direction", "sold")
          .gte("date", s.period_start)
          .lte("date", s.period_end);

        const totalQty = (repRows ?? []).reduce((sum: number, r: { qty: number }) => sum + r.qty, 0);

        enriched.push({
          ...s,
          vendor_name: vendorMap.get(s.vendor_id) ?? "Unknown",
          total_sold_qty: totalQty,
        });
      }

      setSettlements(enriched);
    } else {
      setSettlements([]);
    }

    setLoading(false);
  }

  // Summary calculations
  const totalCommission = useMemo(
    () => settlements.reduce((sum, s) => sum + s.total_owed, 0),
    [settlements]
  );
  const totalPaid = useMemo(
    () => settlements.reduce((sum, s) => sum + s.total_paid, 0),
    [settlements]
  );
  const outstanding = useMemo(
    () => totalCommission - totalPaid,
    [totalCommission, totalPaid]
  );

  const hasActiveFilters = vendorFilter || statusFilter || dateFrom || dateTo;

  function clearFilters() {
    setVendorFilter("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Commission & Settlements
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track commission earned and manage vendor settlements
          </p>
        </div>
        <button
          onClick={() => router.push("/settlements/new")}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Settlement
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">
              Total Commission Earned
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            $
            {totalCommission.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">
              Outstanding Amount
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            $
            {outstanding.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-500">
              Paid Amount
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            $
            {totalPaid.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
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
                {
                  [vendorFilter, statusFilter, dateFrom, dateTo].filter(Boolean)
                    .length
                }
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "" | "pending" | "paid")
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Period From
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
                  Period To
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

      {/* Settlements Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading settlements...</p>
          </div>
        </div>
      ) : settlements.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No settlements found</p>
          <p className="text-sm text-gray-400 mt-1">
            {hasActiveFilters
              ? "Try adjusting your filters"
              : "Create your first settlement to start tracking commissions"}
          </p>
          {!hasActiveFilters && (
            <button
              onClick={() => router.push("/settlements/new")}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Settlement
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Vendor
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Period
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    Sold Qty
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    Total Owed
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    Total Paid
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {settlements.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/settlements/${s.id}`)}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {s.vendor_name}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {format(new Date(s.period_start), "MMM d, yyyy")} &ndash;{" "}
                      {format(new Date(s.period_end), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-semibold tabular-nums">
                      {s.total_sold_qty}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-semibold tabular-nums">
                      $
                      {s.total_owed.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 tabular-nums">
                      $
                      {s.total_paid.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.status === "paid" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          <CheckCircle className="w-3 h-3" />
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
