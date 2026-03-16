"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Vendor } from "@/lib/types";
import { Store, MapPin, Phone, Package, Plus, Search } from "lucide-react";
import { format } from "date-fns";

interface VendorWithSummary extends Vendor {
  total_skus: number;
  total_stock_value: number;
  last_stock_check: string | null;
}

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorWithSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchVendors();
  }, []);

  async function fetchVendors() {
    setLoading(true);
    try {
      // Fetch all vendors
      const { data: vendorRows, error: vendorError } = await supabase
        .from("vendors")
        .select("*")
        .order("name");

      if (vendorError) throw vendorError;
      if (!vendorRows) {
        setVendors([]);
        return;
      }

      // Fetch vendor_skus with sku data for stock value calculation
      const { data: vendorSkus } = await supabase
        .from("vendor_skus")
        .select("vendor_id, current_expected_stock, sku_id, skus(retail_price)");

      // Fetch latest stock check per vendor
      const { data: stockChecks } = await supabase
        .from("stock_checks")
        .select("vendor_id, check_date")
        .eq("status", "completed")
        .order("check_date", { ascending: false });

      // Build summary maps
      const skuCountMap: Record<string, number> = {};
      const stockValueMap: Record<string, number> = {};

      if (vendorSkus) {
        for (const vs of vendorSkus) {
          const vid = vs.vendor_id;
          skuCountMap[vid] = (skuCountMap[vid] || 0) + 1;
          const price =
            (vs as Record<string, unknown>).skus &&
            typeof (vs as Record<string, unknown>).skus === "object"
              ? ((vs as Record<string, unknown>).skus as { retail_price: number })
                  .retail_price
              : 0;
          stockValueMap[vid] =
            (stockValueMap[vid] || 0) + vs.current_expected_stock * price;
        }
      }

      const lastCheckMap: Record<string, string> = {};
      if (stockChecks) {
        for (const sc of stockChecks) {
          if (!lastCheckMap[sc.vendor_id]) {
            lastCheckMap[sc.vendor_id] = sc.check_date;
          }
        }
      }

      const enriched: VendorWithSummary[] = vendorRows.map((v) => ({
        ...v,
        total_skus: skuCountMap[v.id] || 0,
        total_stock_value: stockValueMap[v.id] || 0,
        last_stock_check: lastCheckMap[v.id] || null,
      }));

      setVendors(enriched);
    } catch (err) {
      console.error("Error fetching vendors:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return vendors;
    const q = search.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.address?.toLowerCase().includes(q) ||
        v.contact_person?.toLowerCase().includes(q)
    );
  }, [vendors, search]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your consignment vendors and their stock
          </p>
        </div>
        <button
          onClick={() => router.push("/vendors/new")}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Vendor
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
        <input
          type="text"
          placeholder="Search vendors by name, address, or contact..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading vendors...</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-20">
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-900 mb-1">
            {search ? "No vendors found" : "No vendors yet"}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {search
              ? "Try adjusting your search terms."
              : "Get started by adding your first vendor."}
          </p>
          {!search && (
            <button
              onClick={() => router.push("/vendors/new")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Vendor
            </button>
          )}
        </div>
      )}

      {/* Vendor grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((vendor) => (
            <div
              key={vendor.id}
              onClick={() => router.push(`/vendors/${vendor.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer group"
            >
              {/* Vendor name */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0 group-hover:bg-primary-100 transition-colors">
                  <Store className="w-5 h-5 text-primary-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary-700 transition-colors">
                    {vendor.name}
                  </h3>
                  {vendor.contact_person && (
                    <p className="text-sm text-gray-500 truncate">
                      {vendor.contact_person}
                    </p>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                {vendor.address && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{vendor.address}</span>
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{vendor.phone}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Package className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">SKUs</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {vendor.total_skus}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Stock Value</p>
                  <p className="text-sm font-semibold text-gray-900">
                    ${vendor.total_stock_value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Last Check</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {vendor.last_stock_check
                      ? format(new Date(vendor.last_stock_check), "MMM d")
                      : "Never"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
