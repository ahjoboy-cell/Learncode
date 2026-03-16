"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { StockCheck, StockCheckItem, Vendor, Sku } from "@/lib/types";
import {
  ChevronLeft,
  Check,
  AlertTriangle,
  Calendar,
  User,
  ClipboardCheck,
  Package,
  FileText,
} from "lucide-react";

interface StockCheckDetail extends StockCheck {
  vendor_name: string;
  checker_name: string;
}

interface StockCheckItemDetail extends StockCheckItem {
  sku_code: string;
  sku_name: string;
}

export default function StockCheckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [stockCheck, setStockCheck] = useState<StockCheckDetail | null>(null);
  const [items, setItems] = useState<StockCheckItemDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchStockCheck();
  }, [id]);

  async function fetchStockCheck() {
    setLoading(true);

    try {
      // Fetch stock check
      const { data: checkData, error: checkError } = await supabase
        .from("stock_checks")
        .select("*")
        .eq("id", id)
        .single();

      if (checkError || !checkData) {
        console.error("Error fetching stock check:", checkError);
        setLoading(false);
        return;
      }

      // Fetch vendor and checker names
      const [vendorRes, memberRes] = await Promise.all([
        supabase
          .from("vendors")
          .select("name")
          .eq("id", checkData.vendor_id)
          .single(),
        supabase
          .from("team_members")
          .select("name")
          .eq("id", checkData.checked_by)
          .single(),
      ]);

      const detail: StockCheckDetail = {
        ...checkData,
        vendor_name: vendorRes.data?.name ?? "Unknown",
        checker_name: memberRes.data?.name ?? "Unknown",
      };
      setStockCheck(detail);

      // Fetch stock check items with SKU details
      const { data: itemsData } = await supabase
        .from("stock_check_items")
        .select("*, sku:skus(sku_code, name)")
        .eq("stock_check_id", id);

      if (itemsData) {
        const detailed: StockCheckItemDetail[] = itemsData.map((item) => {
          const sku = (item as Record<string, unknown>).sku as {
            sku_code: string;
            name: string;
          } | null;
          return {
            ...item,
            sku_code: sku?.sku_code ?? "Unknown",
            sku_name: sku?.name ?? "Unknown",
          };
        });
        setItems(detailed);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading stock check...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stockCheck) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-20">
          <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            Stock check not found
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            This stock check may have been deleted or the link is invalid.
          </p>
          <button
            onClick={() => router.push("/stock-check")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Stock Checks
          </button>
        </div>
      </div>
    );
  }

  const totalItems = items.length;
  const discrepancyCount = items.filter((i) => i.discrepancy !== 0).length;
  const totalDiscrepancy = items.reduce((sum, i) => sum + i.discrepancy, 0);
  const totalExpected = items.reduce((sum, i) => sum + i.expected_qty, 0);
  const totalCounted = items.reduce((sum, i) => sum + i.counted_qty, 0);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/stock-check")}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">
              {stockCheck.vendor_name}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                stockCheck.status === "completed"
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {stockCheck.status === "completed" ? "Completed" : "In Progress"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Stock Check Details</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500 font-medium">Date</span>
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {new Date(stockCheck.check_date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500 font-medium">
              Checked By
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {stockCheck.checker_name}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500 font-medium">
              Total Items
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900">{totalItems}</p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            discrepancyCount > 0
              ? "bg-red-50 border-red-200"
              : "bg-green-50 border-green-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {discrepancyCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-red-500" />
            ) : (
              <Check className="w-4 h-4 text-green-500" />
            )}
            <span className="text-xs text-gray-500 font-medium">
              Discrepancies
            </span>
          </div>
          <p
            className={`text-sm font-semibold ${
              discrepancyCount > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {discrepancyCount > 0
              ? `${discrepancyCount} found`
              : "None - All matched"}
          </p>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Item Details</h2>
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase">
                  SKU Code
                </th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase">
                  Name
                </th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase">
                  Expected
                </th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase">
                  Counted
                </th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase">
                  Discrepancy
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => {
                const hasDiscrepancy = item.discrepancy !== 0;
                return (
                  <tr
                    key={item.id}
                    className={hasDiscrepancy ? "bg-red-50" : ""}
                  >
                    <td className="px-5 py-3 font-mono text-gray-600">
                      {item.sku_code}
                    </td>
                    <td className="px-5 py-3 text-gray-900 font-medium">
                      {item.sku_name}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {item.expected_qty}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">
                      {item.counted_qty}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {hasDiscrepancy ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {item.discrepancy > 0 ? "+" : ""}
                          {item.discrepancy}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-green-600">
                          <Check className="w-3.5 h-3.5" />
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals Row */}
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td
                  colSpan={2}
                  className="px-5 py-3 font-semibold text-gray-900"
                >
                  Totals
                </td>
                <td className="px-5 py-3 text-right font-semibold text-gray-900">
                  {totalExpected}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-gray-900">
                  {totalCounted}
                </td>
                <td className="px-5 py-3 text-right">
                  <span
                    className={`font-bold ${
                      totalDiscrepancy !== 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {totalDiscrepancy > 0 ? "+" : ""}
                    {totalDiscrepancy}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden divide-y divide-gray-100">
          {items.map((item) => {
            const hasDiscrepancy = item.discrepancy !== 0;
            return (
              <div
                key={item.id}
                className={`px-4 py-3 ${hasDiscrepancy ? "bg-red-50" : ""}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm">
                      {item.sku_name}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {item.sku_code}
                    </p>
                  </div>
                  {hasDiscrepancy ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 ml-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {item.discrepancy > 0 ? "+" : ""}
                      {item.discrepancy}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 ml-2">
                      <Check className="w-3.5 h-3.5" />
                      OK
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    Expected:{" "}
                    <span className="font-medium text-gray-700">
                      {item.expected_qty}
                    </span>
                  </span>
                  <span>
                    Counted:{" "}
                    <span className="font-medium text-gray-700">
                      {item.counted_qty}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}

          {/* Mobile Totals */}
          <div className="px-4 py-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                Totals
              </span>
              <span
                className={`text-sm font-bold ${
                  totalDiscrepancy !== 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                Net: {totalDiscrepancy > 0 ? "+" : ""}
                {totalDiscrepancy}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
              <span>
                Expected:{" "}
                <span className="font-medium">{totalExpected}</span>
              </span>
              <span>
                Counted: <span className="font-medium">{totalCounted}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {stockCheck.notes && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Notes</h2>
          </div>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {stockCheck.notes}
          </p>
        </div>
      )}
    </div>
  );
}
