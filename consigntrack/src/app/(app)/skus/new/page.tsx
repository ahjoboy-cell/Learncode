"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Package, ArrowLeft, Save } from "lucide-react";

const SUGGESTED_CATEGORIES = [
  "Electronics",
  "Clothing",
  "Accessories",
  "Home & Garden",
  "Food & Beverage",
  "Health & Beauty",
  "Sports",
  "Toys",
  "Books",
  "Other",
];

export default function NewSkuPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customCategory, setCustomCategory] = useState(false);
  const [form, setForm] = useState({
    sku_code: "",
    name: "",
    description: "",
    category: "",
    unit_cost: "",
    retail_price: "",
    commission_per_unit: "",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!form.sku_code.trim()) {
      setError("SKU code is required.");
      return;
    }
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { error: insertError } = await supabase.from("skus").insert({
        sku_code: form.sku_code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        unit_cost: parseFloat(form.unit_cost) || 0,
        retail_price: parseFloat(form.retail_price) || 0,
        commission_per_unit: parseFloat(form.commission_per_unit) || 0,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          setError("A SKU with this code already exists.");
        } else {
          setError(insertError.message);
        }
        return;
      }

      router.push("/skus");
    } catch (err) {
      console.error("Error creating SKU:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/skus")}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to SKU Catalog
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
          <Package className="w-5 h-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New SKU</h1>
          <p className="text-sm text-gray-500">Register a new product in your catalog</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* SKU Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              SKU Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.sku_code}
              onChange={(e) => updateField("sku_code", e.target.value.toUpperCase())}
              placeholder="e.g., PROD-001"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">Unique identifier for this product</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Product name"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Optional product description"
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <div className="space-y-2">
              <select
                value={customCategory ? "__custom" : form.category}
                onChange={(e) => {
                  if (e.target.value === "__custom") {
                    setCustomCategory(true);
                    updateField("category", "");
                  } else {
                    setCustomCategory(false);
                    updateField("category", e.target.value);
                  }
                }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
              >
                <option value="">Select a category</option>
                {SUGGESTED_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__custom">Custom category...</option>
              </select>
              {customCategory && (
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  placeholder="Enter custom category"
                  autoFocus
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              )}
            </div>
          </div>

          {/* Pricing Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Unit Cost */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit Cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unit_cost}
                  onChange={(e) => updateField("unit_cost", e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Retail Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Retail Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.retail_price}
                  onChange={(e) => updateField("retail_price", e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Commission Per Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Commission/Unit</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.commission_per_unit}
                  onChange={(e) => updateField("commission_per_unit", e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-gray-200 rounded-b-xl flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/skus")}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save SKU"}
          </button>
        </div>
      </form>
    </div>
  );
}
