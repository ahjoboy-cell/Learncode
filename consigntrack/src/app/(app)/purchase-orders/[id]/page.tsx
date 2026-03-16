"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PurchaseOrder, PurchaseOrderItem, Vendor, Sku } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import {
  ArrowLeft,
  FileText,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  PackageCheck,
  Save,
} from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<string, { label: string; icon: typeof Clock; bg: string; text: string }> = {
  draft: { label: "Draft", icon: FileText, bg: "bg-gray-50", text: "text-gray-600" },
  sent: { label: "Sent", icon: Send, bg: "bg-blue-50", text: "text-blue-700" },
  acknowledged: { label: "Acknowledged", icon: CheckCircle, bg: "bg-indigo-50", text: "text-indigo-700" },
  shipped: { label: "Shipped", icon: Truck, bg: "bg-amber-50", text: "text-amber-700" },
  received: { label: "Received", icon: PackageCheck, bg: "bg-emerald-50", text: "text-emerald-700" },
  cancelled: { label: "Cancelled", icon: XCircle, bg: "bg-red-50", text: "text-red-700" },
};

const statusOrder = ["draft", "sent", "acknowledged", "shipped", "received"];

export default function PurchaseOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { currentUser } = useAuth();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<(PurchaseOrderItem & { sku_code: string; sku_name: string })[]>([]);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  async function fetchData() {
    setLoading(true);
    const { data: poData } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!poData) {
      router.push("/purchase-orders");
      return;
    }
    setPo(poData);

    const [vendorRes, itemsRes, skuRes] = await Promise.all([
      supabase.from("vendors").select("*").eq("id", poData.vendor_id).single(),
      supabase.from("purchase_order_items").select("*").eq("purchase_order_id", poData.id),
      supabase.from("skus").select("id, sku_code, name"),
    ]);

    if (vendorRes.data) setVendor(vendorRes.data);

    if (itemsRes.data && skuRes.data) {
      const skuMap = new Map(skuRes.data.map((s) => [s.id, { code: s.sku_code, name: s.name }]));
      setItems(
        itemsRes.data.map((item) => ({
          ...item,
          sku_code: skuMap.get(item.sku_id)?.code ?? "",
          sku_name: skuMap.get(item.sku_id)?.name ?? "Unknown",
        }))
      );
    }

    setLoading(false);
  }

  async function updateStatus(newStatus: string) {
    if (!po) return;
    setUpdating(true);
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: newStatus })
      .eq("id", po.id);

    if (!error) {
      setPo({ ...po, status: newStatus as PurchaseOrder["status"] });
      await logAudit("update_status", "purchase_order", po.id, `Status changed to ${newStatus}`, currentUser?.id ?? "");
    }
    setUpdating(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!po) return null;

  const sc = statusConfig[po.status] || statusConfig.draft;
  const StatusIcon = sc.icon;
  const currentIdx = statusOrder.indexOf(po.status);
  const nextStatus = currentIdx >= 0 && currentIdx < statusOrder.length - 1 ? statusOrder[currentIdx + 1] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => router.push("/purchase-orders")}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Purchase Orders
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <span className="font-mono">{po.po_number}</span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
              <StatusIcon className="w-3 h-3" />
              {sc.label}
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {vendor?.name} &middot; {format(new Date(po.order_date), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {nextStatus && po.status !== "cancelled" && (
            <button
              onClick={() => updateStatus(nextStatus)}
              disabled={updating}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {updating ? "Updating..." : `Mark as ${statusConfig[nextStatus]?.label}`}
            </button>
          )}
          {po.status !== "cancelled" && po.status !== "received" && (
            <button
              onClick={() => updateStatus("cancelled")}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Order Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Vendor</p>
            <p className="text-sm font-medium text-gray-900">{vendor?.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Order Date</p>
            <p className="text-sm font-medium text-gray-900">{format(new Date(po.order_date), "MMM d, yyyy")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Expected Delivery</p>
            <p className="text-sm font-medium text-gray-900">
              {po.expected_delivery_date ? format(new Date(po.expected_delivery_date), "MMM d, yyyy") : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Total Amount</p>
            <p className="text-sm font-bold text-gray-900">
              ${po.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        {po.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{po.notes}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-slate-600">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Product</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Qty</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Unit Cost</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Line Total</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                      {item.sku_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.sku_name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.qty}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    ${item.unit_cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">
                    ${item.line_total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${item.received_qty >= item.qty ? "text-emerald-600" : "text-gray-700"}`}>
                      {item.received_qty} / {item.qty}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
