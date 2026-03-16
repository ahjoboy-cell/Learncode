"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { VendorInvoice, Vendor, PurchaseOrder } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  DollarSign,
  FileSpreadsheet,
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";

const statusConfig: Record<string, { label: string; icon: typeof Clock; bg: string; text: string }> = {
  pending: { label: "Pending", icon: Clock, bg: "bg-gray-50", text: "text-gray-600" },
  approved: { label: "Approved", icon: CheckCircle, bg: "bg-blue-50", text: "text-blue-700" },
  partially_paid: { label: "Partially Paid", icon: DollarSign, bg: "bg-amber-50", text: "text-amber-700" },
  paid: { label: "Paid", icon: CheckCircle, bg: "bg-emerald-50", text: "text-emerald-700" },
  overdue: { label: "Overdue", icon: AlertTriangle, bg: "bg-red-50", text: "text-red-700" },
  cancelled: { label: "Cancelled", icon: XCircle, bg: "bg-gray-50", text: "text-gray-500" },
};

export default function VendorInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { currentUser } = useAuth();
  const [invoice, setInvoice] = useState<VendorInvoice | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [recording, setRecording] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  async function fetchData() {
    setLoading(true);
    const { data: invData } = await supabase
      .from("vendor_invoices")
      .select("*")
      .eq("id", params.id)
      .single();

    if (!invData) {
      router.push("/vendor-invoices");
      return;
    }

    // Check overdue
    let status = invData.status;
    if ((status === "pending" || status === "approved") && isPast(parseISO(invData.due_date))) {
      status = "overdue";
    }
    setInvoice({ ...invData, status });

    const { data: vendorData } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", invData.vendor_id)
      .single();
    if (vendorData) setVendor(vendorData);

    if (invData.purchase_order_id) {
      const { data: poData } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("id", invData.purchase_order_id)
        .single();
      if (poData) setPo(poData);
    }

    setLoading(false);
  }

  async function recordPayment() {
    if (!invoice || paymentAmount <= 0) return;

    setRecording(true);
    const newPaid = invoice.amount_paid + paymentAmount;
    const balance = invoice.total_amount - newPaid;
    const newStatus = balance <= 0 ? "paid" : "partially_paid";

    const { error } = await supabase
      .from("vendor_invoices")
      .update({ amount_paid: newPaid, status: newStatus })
      .eq("id", invoice.id);

    if (!error) {
      setInvoice({ ...invoice, amount_paid: newPaid, status: newStatus });
      setPaymentAmount(0);
      setShowPayment(false);
      await logAudit(
        "record_payment",
        "vendor_invoice",
        invoice.id,
        `Payment of $${paymentAmount.toFixed(2)} recorded. New balance: $${Math.max(0, balance).toFixed(2)}`,
        currentUser?.id ?? ""
      );
    }
    setRecording(false);
  }

  async function updateStatus(newStatus: string) {
    if (!invoice) return;
    const { error } = await supabase
      .from("vendor_invoices")
      .update({ status: newStatus })
      .eq("id", invoice.id);
    if (!error) {
      setInvoice({ ...invoice, status: newStatus as VendorInvoice["status"] });
      await logAudit("update_status", "vendor_invoice", invoice.id, `Status changed to ${newStatus}`, currentUser?.id ?? "");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!invoice) return null;

  const sc = statusConfig[invoice.status] || statusConfig.pending;
  const StatusIcon = sc.icon;
  const balance = invoice.total_amount - invoice.amount_paid;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => router.push("/vendor-invoices")}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Invoices
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-primary-600" />
            {invoice.invoice_number}
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
              <StatusIcon className="w-3 h-3" />
              {sc.label}
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {vendor?.name} &middot; Due {format(new Date(invoice.due_date), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <button
              onClick={() => setShowPayment(!showPayment)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              Record Payment
            </button>
          )}
          {invoice.status === "pending" && (
            <button
              onClick={() => updateStatus("approved")}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </button>
          )}
          {invoice.status !== "cancelled" && invoice.status !== "paid" && (
            <button
              onClick={() => updateStatus("cancelled")}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Payment Form */}
      {showPayment && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
          <h3 className="text-sm font-semibold text-emerald-800 mb-3">Record Payment</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-emerald-700 mb-1">Payment Amount</label>
              <input
                type="number"
                min={0.01}
                max={balance}
                step={0.01}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={() => setPaymentAmount(balance)}
              className="px-3 py-2 text-xs font-medium text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-100"
            >
              Pay Full (${balance.toFixed(2)})
            </button>
            <button
              onClick={recordPayment}
              disabled={recording || paymentAmount <= 0}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {recording ? "Recording..." : "Confirm"}
            </button>
          </div>
        </div>
      )}

      {/* Invoice Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Vendor</p>
            <p className="text-sm font-medium text-gray-900">{vendor?.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Invoice Date</p>
            <p className="text-sm font-medium text-gray-900">{format(new Date(invoice.invoice_date), "MMM d, yyyy")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Due Date</p>
            <p className={`text-sm font-medium ${invoice.status === "overdue" ? "text-red-600" : "text-gray-900"}`}>
              {format(new Date(invoice.due_date), "MMM d, yyyy")}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Linked PO</p>
            <p className="text-sm font-medium text-gray-900">
              {po ? (
                <button
                  onClick={() => router.push(`/purchase-orders/${po.id}`)}
                  className="text-primary-600 hover:underline font-mono text-xs"
                >
                  {po.po_number}
                </button>
              ) : (
                <span className="text-gray-400">None</span>
              )}
            </p>
          </div>
        </div>
        {invoice.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Summary</h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="text-gray-900 font-medium tabular-nums">
              ${invoice.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tax</span>
            <span className="text-gray-900 font-medium tabular-nums">
              ${invoice.tax_amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
            <span className="text-gray-900 font-semibold">Total</span>
            <span className="text-gray-900 font-bold tabular-nums">
              ${invoice.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-emerald-600 font-medium">Paid</span>
            <span className="text-emerald-600 font-semibold tabular-nums">
              −${invoice.amount_paid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
            <span className={`font-bold ${balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              Balance Due
            </span>
            <span className={`text-lg font-bold tabular-nums ${balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              ${Math.max(0, balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
