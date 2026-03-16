"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Sku, VendorSku } from "@/lib/types";
import { Package, Plus, Search, Filter, DollarSign } from "lucide-react";

export default function SkuListPage() {
  const router = useRouter();
  const [skus, setSkus] = useState<Sku[]>([]);
  const [vendorSkus, setVendorSkus] = useState<VendorSku[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [skuRes, vsRes] = await Promise.all([
        supabase.from("skus").select("*").order("sku_code"),
        supabase.from("vendor_skus").select("*"),
      ]);
      if (skuRes.data) setSkus(skuRes.data);
      if (vsRes.data) setVendorSkus(vsRes.data);
      setLoading(false);
    }
    fetchData();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(skus.map((s) => s.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [skus]);

  // Build a map of sku_id -> total expected stock across all vendors
  const stockBySku = useMemo(() => {
    const map: Record<string, number> = {};
    for (const vs of vendorSkus) {
      map[vs.sku_id] = (map[vs.sku_id] || 0) + vs.current_expected_stock;
    }
    return map;
  }, [vendorSkus]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return skus.filter((s) => {
      const matchesSearch =
        !q ||
        s.sku_code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q));
      const matchesCategory = !categoryFilter || s.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [skus, search, categoryFilter]);

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading SKUs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SKU Catalog</h1>
            <p className="text-sm text-gray-500">
              {skus.length} product{skus.length !== 1 ? "s" : ""} registered
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/skus/new")}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add SKU
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code, name, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white appearance-none min-w-[180px]"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No SKUs found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search || categoryFilter
              ? "Try adjusting your search or filter"
              : "Add your first SKU to get started"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">
                    SKU Code
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">
                    Category
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      Unit Cost
                    </span>
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      Retail
                    </span>
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">
                    Commission
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">
                    Total Stock
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((sku) => (
                  <tr
                    key={sku.id}
                    onClick={() => router.push(`/skus/${sku.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                        {sku.sku_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {sku.name}
                    </td>
                    <td className="px-4 py-3">
                      {sku.category ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {sku.category}
                        </span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatCurrency(sku.unit_cost)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatCurrency(sku.retail_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatCurrency(sku.commission_per_unit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-semibold ${
                          (stockBySku[sku.id] || 0) === 0
                            ? "text-gray-400"
                            : "text-gray-900"
                        }`}
                      >
                        {stockBySku[sku.id] || 0}
                      </span>
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
