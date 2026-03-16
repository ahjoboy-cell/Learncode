"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { StockCheck, Vendor } from "@/lib/types";
import {
  ClipboardCheck,
  Plus,
  ChevronRight,
  Search,
  Calendar,
  Filter,
} from "lucide-react";

interface StockCheckWithDetails extends StockCheck {
  vendor_name: string;
  checker_name: string;
  total_items: number;
  discrepancies: number;
}

export default function StockCheckHub() {
  const router = useRouter();
  const [stockChecks, setStockChecks] = useState<StockCheckWithDetails[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
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

    // Build stock checks query
    let query = supabase
      .from("stock_checks")
      .select("*")
      .order("check_date", { ascending: false });

    if (vendorFilter) {
      query = query.eq("vendor_id", vendorFilter);
    }
    if (dateFrom) {
      query = query.gte("check_date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("check_date", dateTo);
    }

    const { data: checksData } = await query;

    if (checksData && checksData.length > 0) {
      // Fetch related data
      const vendorIds = [...new Set(checksData.map((c) => c.vendor_id))];
      const checkerIds = [...new Set(checksData.map((c) => c.checked_by))];
      const checkIds = checksData.map((c) => c.id);

      const [vendorsRes, membersRes, itemsRes] = await Promise.all([
        supabase.from("vendors").select("id, name").in("id", vendorIds),
        supabase.from("team_members").select("id, name").in("id", checkerIds),
        supabase
          .from("stock_check_items")
          .select("stock_check_id, discrepancy")
          .in("stock_check_id", checkIds),
      ]);

      const vendorMap = new Map(
        (vendorsRes.data ?? []).map((v) => [v.id, v.name])
      );
      const memberMap = new Map(
        (membersRes.data ?? []).map((m) => [m.id, m.name])
      );

      const itemsByCheck = new Map<
        string,
        { total: number; discrepancies: number }
      >();
      for (const item of itemsRes.data ?? []) {
        const existing = itemsByCheck.get(item.stock_check_id) ?? {
          total: 0,
          discrepancies: 0,
        };
        existing.total += 1;
        if (item.discrepancy !== 0) existing.discrepancies += 1;
        itemsByCheck.set(item.stock_check_id, existing);
      }

      const enriched: StockCheckWithDetails[] = checksData.map((c) => ({
        ...c,
        vendor_name: vendorMap.get(c.vendor_id) ?? "Unknown",
        checker_name: memberMap.get(c.checked_by) ?? "Unknown",
        total_items: itemsByCheck.get(c.id)?.total ?? 0,
        discrepancies: itemsByCheck.get(c.id)?.discrepancies ?? 0,
      }));

      setStockChecks(enriched);
    } else {
      setStockChecks([]);
    }

    setLoading(false);
  }

  function clearFilters() {
    setVendorFilter("");
    setDateFrom("");
    setDateTo("");
  }

  const hasActiveFilters = vendorFilter || dateFrom || dateTo;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Check</h1>
          <p className="text-sm text-gray-500 mt-1">
            Verify inventory at vendor locations
          </p>
        </div>
        <Link
          href="/stock-check/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Stock Check</span>
          <span className="sm:hidden">New</span>
        </Link>
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

      {/* Stock Check List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : stockChecks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No stock checks found</p>
          <p className="text-sm text-gray-400 mt-1">
            {hasActiveFilters
              ? "Try adjusting your filters"
              : "Start your first stock check to verify inventory"}
          </p>
          {!hasActiveFilters && (
            <Link
              href="/stock-check/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Stock Check
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {stockChecks.map((check) => (
            <button
              key={check.id}
              onClick={() => router.push(`/stock-check/${check.id}`)}
              className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {check.vendor_name}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        check.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {check.status === "completed"
                        ? "Completed"
                        : "In Progress"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(check.check_date).toLocaleDateString()}
                    </span>
                    <span>by {check.checker_name}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-gray-600">
                      {check.total_items} items
                    </span>
                    {check.discrepancies > 0 && (
                      <span className="text-red-600 font-medium">
                        {check.discrepancies} discrepanc
                        {check.discrepancies === 1 ? "y" : "ies"}
                      </span>
                    )}
                    {check.discrepancies === 0 && check.total_items > 0 && (
                      <span className="text-green-600 font-medium">
                        All matched
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
