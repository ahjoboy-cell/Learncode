"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { exportToExcel, applyCurrencyColumns } from "@/lib/excel-export";
import { exportToCSV } from "@/lib/csv-utils";
import { parseImportFile, downloadTemplate } from "@/lib/csv-utils";
import { useAuth } from "@/lib/auth-context";
import { logAudit } from "@/lib/audit";
import {
  BarChart3,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  Package,
  Store,
  Barcode,
  ClipboardCheck,
  DollarSign,
  PackagePlus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

type ExportSection =
  | "skus"
  | "vendors"
  | "vendor_skus"
  | "stock_checks"
  | "replenishments"
  | "sales"
  | "settlements"
  | "purchase_orders"
  | "vendor_invoices"
  | "alerts";

type ImportTarget = "skus" | "vendors" | "purchase_orders" | "vendor_invoices";

const exportSections: {
  key: ExportSection;
  label: string;
  icon: typeof Package;
  description: string;
}[] = [
  { key: "skus", label: "SKU Catalog", icon: Barcode, description: "All products with pricing" },
  { key: "vendors", label: "Vendors", icon: Store, description: "All vendor details" },
  { key: "vendor_skus", label: "Vendor-SKU Assignments", icon: Package, description: "Stock levels per vendor" },
  { key: "stock_checks", label: "Stock Checks", icon: ClipboardCheck, description: "Physical inventory records" },
  { key: "replenishments", label: "Replenishments", icon: PackagePlus, description: "Stock movement log" },
  { key: "sales", label: "Sales", icon: DollarSign, description: "All sale transactions" },
  { key: "settlements", label: "Settlements", icon: DollarSign, description: "Commission settlements" },
  { key: "purchase_orders", label: "Purchase Orders", icon: FileText, description: "All vendor POs" },
  { key: "vendor_invoices", label: "Vendor Invoices", icon: FileSpreadsheet, description: "All vendor invoices" },
  { key: "alerts", label: "Alerts", icon: AlertTriangle, description: "System alerts history" },
];

const importTargets: {
  key: ImportTarget;
  label: string;
  description: string;
  templateHeaders: string[];
}[] = [
  {
    key: "skus",
    label: "SKU Catalog",
    description: "Bulk import products with pricing",
    templateHeaders: ["sku_code", "name", "description", "category", "unit_cost", "retail_price", "commission_per_unit"],
  },
  {
    key: "vendors",
    label: "Vendors",
    description: "Bulk import vendor details",
    templateHeaders: ["name", "address", "contact_person", "phone", "email", "notes"],
  },
  {
    key: "purchase_orders",
    label: "Purchase Orders",
    description: "Import PO records",
    templateHeaders: ["po_number", "vendor_name", "order_date", "expected_delivery_date", "status", "total_amount", "notes"],
  },
  {
    key: "vendor_invoices",
    label: "Vendor Invoices",
    description: "Import invoice records",
    templateHeaders: ["invoice_number", "vendor_name", "invoice_date", "due_date", "subtotal", "tax_amount", "total_amount", "status", "notes"],
  },
];

export default function ReportsPage() {
  const { currentUser } = useAuth();
  const [exportingKey, setExportingKey] = useState<ExportSection | null>(null);
  const [importTarget, setImportTarget] = useState<ImportTarget | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [vendorMap, setVendorMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    supabase.from("vendors").select("id, name").then(({ data }) => {
      if (data) {
        setVendorMap(new Map(data.map((v) => [v.name.toLowerCase(), v.id])));
      }
    });
  }, []);

  async function handleExport(section: ExportSection, format: "xlsx" | "csv") {
    setExportingKey(section);
    try {
      const { data, error } = await supabase.from(section).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) {
        alert(`No ${section} data to export.`);
        return;
      }

      // Remove id and uuid fields for cleaner export
      const cleanData = data.map((row: Record<string, unknown>) => {
        const clean: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          if (key === "id") continue;
          clean[key] = value;
        }
        return clean;
      });

      const currencyKeys = ["unit_cost", "retail_price", "commission_per_unit", "sale_price", "commission_amount", "total_owed", "total_paid", "total_amount", "subtotal", "tax_amount", "amount_paid", "line_total"];
      const fileName = `consigntrack_${section}_${new Date().toISOString().slice(0, 10)}`;

      if (format === "xlsx") {
        exportToExcel(applyCurrencyColumns(cleanData, currencyKeys), section, fileName);
      } else {
        exportToCSV(cleanData, fileName);
      }

      await logAudit("export", section, "", `Exported ${data.length} rows as ${format.toUpperCase()}`, currentUser?.id ?? "");
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setExportingKey(null);
    }
  }

  async function handleImport() {
    if (!importFile || !importTarget) return;

    setImporting(true);
    setImportResult(null);

    try {
      const { rows } = await parseImportFile(importFile);
      if (rows.length === 0) {
        setImportResult({ success: 0, errors: ["File is empty or has no data rows."] });
        return;
      }

      let successCount = 0;
      const errors: string[] = [];

      if (importTarget === "skus") {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row.sku_code || !row.name) {
            errors.push(`Row ${i + 2}: sku_code and name are required`);
            continue;
          }
          const { error } = await supabase.from("skus").upsert(
            {
              sku_code: row.sku_code,
              name: row.name,
              description: row.description || null,
              category: row.category || null,
              unit_cost: parseFloat(row.unit_cost) || 0,
              retail_price: parseFloat(row.retail_price) || 0,
              commission_per_unit: parseFloat(row.commission_per_unit) || 0,
            },
            { onConflict: "sku_code" }
          );
          if (error) {
            errors.push(`Row ${i + 2}: ${error.message}`);
          } else {
            successCount++;
          }
        }
      } else if (importTarget === "vendors") {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row.name) {
            errors.push(`Row ${i + 2}: name is required`);
            continue;
          }
          const { error } = await supabase.from("vendors").insert({
            name: row.name,
            address: row.address || null,
            contact_person: row.contact_person || null,
            phone: row.phone || null,
            email: row.email || null,
            notes: row.notes || null,
          });
          if (error) {
            errors.push(`Row ${i + 2}: ${error.message}`);
          } else {
            successCount++;
          }
        }
      } else if (importTarget === "purchase_orders") {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row.po_number || !row.vendor_name) {
            errors.push(`Row ${i + 2}: po_number and vendor_name are required`);
            continue;
          }
          const vid = vendorMap.get(row.vendor_name.toLowerCase());
          if (!vid) {
            errors.push(`Row ${i + 2}: Vendor "${row.vendor_name}" not found`);
            continue;
          }
          const { error } = await supabase.from("purchase_orders").insert({
            po_number: row.po_number,
            vendor_id: vid,
            order_date: row.order_date || new Date().toISOString().slice(0, 10),
            expected_delivery_date: row.expected_delivery_date || null,
            status: row.status || "draft",
            total_amount: parseFloat(row.total_amount) || 0,
            notes: row.notes || null,
            created_by: currentUser?.id || null,
          });
          if (error) {
            errors.push(`Row ${i + 2}: ${error.message}`);
          } else {
            successCount++;
          }
        }
      } else if (importTarget === "vendor_invoices") {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row.invoice_number || !row.vendor_name) {
            errors.push(`Row ${i + 2}: invoice_number and vendor_name are required`);
            continue;
          }
          const vid = vendorMap.get(row.vendor_name.toLowerCase());
          if (!vid) {
            errors.push(`Row ${i + 2}: Vendor "${row.vendor_name}" not found`);
            continue;
          }
          const { error } = await supabase.from("vendor_invoices").insert({
            invoice_number: row.invoice_number,
            vendor_id: vid,
            invoice_date: row.invoice_date || new Date().toISOString().slice(0, 10),
            due_date: row.due_date || new Date().toISOString().slice(0, 10),
            subtotal: parseFloat(row.subtotal) || 0,
            tax_amount: parseFloat(row.tax_amount) || 0,
            total_amount: parseFloat(row.total_amount) || 0,
            status: row.status || "pending",
            notes: row.notes || null,
          });
          if (error) {
            errors.push(`Row ${i + 2}: ${error.message}`);
          } else {
            successCount++;
          }
        }
      }

      setImportResult({ success: successCount, errors });
      await logAudit("import", importTarget, "", `Imported ${successCount} rows, ${errors.length} errors`, currentUser?.id ?? "");
    } catch (err) {
      setImportResult({
        success: 0,
        errors: [err instanceof Error ? err.message : "Unknown error"],
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Data</h1>
          <p className="text-sm text-gray-500">Export reports and bulk import data</p>
        </div>
      </div>

      {/* EXPORT SECTION */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-gray-400" />
          Export Data
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exportSections.map((section) => {
            const Icon = section.icon;
            const isExporting = exportingKey === section.key;
            return (
              <div
                key={section.key}
                className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                    <Icon className="w-4.5 h-4.5 text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{section.label}</p>
                    <p className="text-xs text-gray-500 truncate">{section.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport(section.key, "xlsx")}
                    disabled={isExporting}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    {isExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    )}
                    Excel
                  </button>
                  <button
                    onClick={() => handleExport(section.key, "csv")}
                    disabled={isExporting}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    {isExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    CSV
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* IMPORT SECTION */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-gray-400" />
          Bulk Import
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {/* Target selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What are you importing?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {importTargets.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setImportTarget(t.key);
                    setImportFile(null);
                    setImportResult(null);
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    importTarget === t.key
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-700"
                  }`}
                >
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {importTarget && (
            <>
              {/* Template download */}
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-lg">
                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                <p className="text-sm text-blue-700 flex-1">
                  Download the template CSV with the correct headers, fill in your data, then upload.
                </p>
                <button
                  onClick={() => {
                    const target = importTargets.find((t) => t.key === importTarget);
                    if (target) downloadTemplate(target.templateHeaders, target.key);
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  Download Template
                </button>
              </div>

              {/* File upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File (.csv or .xlsx)
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] || null);
                    setImportResult(null);
                  }}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>

              {/* Import button */}
              <button
                onClick={handleImport}
                disabled={!importFile || importing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Import Data
                  </>
                )}
              </button>

              {/* Import results */}
              {importResult && (
                <div className="space-y-2">
                  {importResult.success > 0 && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <p className="text-sm text-emerald-700">
                        Successfully imported {importResult.success} row{importResult.success !== 1 ? "s" : ""}.
                      </p>
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="px-4 py-3 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <p className="text-sm font-medium text-red-700">
                          {importResult.errors.length} error{importResult.errors.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <ul className="text-xs text-red-600 space-y-1 max-h-40 overflow-y-auto">
                        {importResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
