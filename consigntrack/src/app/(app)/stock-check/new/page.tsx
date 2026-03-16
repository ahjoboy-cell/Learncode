"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Vendor, Sku, VendorSku } from "@/lib/types";
import {
  Camera,
  ScanLine,
  Upload,
  Check,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  X,
  Plus,
  Minus,
  Loader2,
  ImageIcon,
} from "lucide-react";

type ScanMode = "manual" | "camera" | "ai-batch";

interface CountItem {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  expected_qty: number;
  counted_qty: number;
}

const STEPS = ["Select Vendor", "Count Items", "Review", "Submit"];

export default function NewStockCheckPage() {
  const router = useRouter();
  const { currentUser } = useAuth();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Vendor selection
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [vendorsLoading, setVendorsLoading] = useState(true);

  // Step 2: Scan mode and counting
  const [scanMode, setScanMode] = useState<ScanMode | null>(null);
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [vendorSkus, setVendorSkus] = useState<(VendorSku & { sku: Sku })[]>(
    []
  );
  const [skusLoading, setSkusLoading] = useState(false);

  // Camera scan state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSku, setCameraSku] = useState("");
  const streamRef = useRef<MediaStream | null>(null);

  // AI batch scan state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState<string | null>(null);

  // Step 3: Review
  const [notes, setNotes] = useState("");

  // Step 4: Submitting
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Fetch vendors on mount
  useEffect(() => {
    async function loadVendors() {
      const { data } = await supabase
        .from("vendors")
        .select("*")
        .order("name");
      if (data) setVendors(data);
      setVendorsLoading(false);
    }
    loadVendors();
  }, []);

  // Fetch vendor SKUs when vendor is selected
  useEffect(() => {
    if (!selectedVendorId) {
      setVendorSkus([]);
      return;
    }
    async function loadSkus() {
      setSkusLoading(true);
      const { data } = await supabase
        .from("vendor_skus")
        .select("*, sku:skus(*)")
        .eq("vendor_id", selectedVendorId);

      if (data) {
        const typed = data as unknown as (VendorSku & { sku: Sku })[];
        setVendorSkus(typed);
        // Initialize count items
        setCountItems(
          typed.map((vs) => ({
            sku_id: vs.sku_id,
            sku_code: vs.sku.sku_code,
            sku_name: vs.sku.name,
            expected_qty: vs.current_expected_stock,
            counted_qty: 0,
          }))
        );
      }
      setSkusLoading(false);
    }
    loadSkus();
  }, [selectedVendorId]);

  // Cleanup camera on unmount or mode change
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("Unable to access camera. Please check permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  function handleCameraScan() {
    if (!cameraSku.trim()) return;
    const code = cameraSku.trim().toUpperCase();
    const existing = countItems.find(
      (item) => item.sku_code.toUpperCase() === code
    );
    if (existing) {
      setCountItems((prev) =>
        prev.map((item) =>
          item.sku_code.toUpperCase() === code
            ? { ...item, counted_qty: item.counted_qty + 1 }
            : item
        )
      );
    } else {
      // SKU not in expected list - add it with 0 expected
      const matchedSku = vendorSkus.find(
        (vs) => vs.sku.sku_code.toUpperCase() === code
      );
      if (matchedSku) {
        setCountItems((prev) => [
          ...prev,
          {
            sku_id: matchedSku.sku_id,
            sku_code: matchedSku.sku.sku_code,
            sku_name: matchedSku.sku.name,
            expected_qty: matchedSku.current_expected_stock,
            counted_qty: 1,
          },
        ]);
      }
      // If SKU not found at all, we could show an error
    }
    setCameraSku("");
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = () => setUploadedImage(reader.result as string);
    reader.readAsDataURL(file);
    setAiResults(null);
  }

  function handleAiAnalyze() {
    if (!uploadedFile) return;
    setAiAnalyzing(true);
    // Placeholder - actual API call will be added separately
    setTimeout(() => {
      setAiAnalyzing(false);
      setAiResults(
        "AI analysis will be connected in a future update. For now, please use Manual Entry or Camera Scan to count items."
      );
    }, 2000);
  }

  function updateCount(skuId: string, delta: number) {
    setCountItems((prev) =>
      prev.map((item) =>
        item.sku_id === skuId
          ? { ...item, counted_qty: Math.max(0, item.counted_qty + delta) }
          : item
      )
    );
  }

  function setCount(skuId: string, value: number) {
    setCountItems((prev) =>
      prev.map((item) =>
        item.sku_id === skuId
          ? { ...item, counted_qty: Math.max(0, value) }
          : item
      )
    );
  }

  const discrepancies = countItems.filter(
    (item) => item.counted_qty !== item.expected_qty
  );
  const totalDiscrepancy = countItems.reduce(
    (sum, item) => sum + (item.counted_qty - item.expected_qty),
    0
  );

  async function handleSubmit() {
    if (!currentUser || !selectedVendorId) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      // Create stock check record
      const { data: stockCheck, error: checkError } = await supabase
        .from("stock_checks")
        .insert({
          vendor_id: selectedVendorId,
          checked_by: currentUser.id,
          check_date: new Date().toISOString().split("T")[0],
          status: "completed",
          notes,
        })
        .select()
        .single();

      if (checkError) throw checkError;

      // Create stock check items
      const items = countItems.map((item) => ({
        stock_check_id: stockCheck.id,
        sku_id: item.sku_id,
        expected_qty: item.expected_qty,
        counted_qty: item.counted_qty,
        discrepancy: item.counted_qty - item.expected_qty,
        notes: "",
      }));

      const { error: itemsError } = await supabase
        .from("stock_check_items")
        .insert(items);

      if (itemsError) throw itemsError;

      // Create alerts for discrepancies
      const alertItems = countItems.filter(
        (item) => item.counted_qty !== item.expected_qty
      );
      if (alertItems.length > 0) {
        const alerts = alertItems.map((item) => ({
          type: "discrepancy" as const,
          vendor_id: selectedVendorId,
          sku_id: item.sku_id,
          message: `Stock discrepancy for ${item.sku_code} (${item.sku_name}): expected ${item.expected_qty}, counted ${item.counted_qty} (${item.counted_qty - item.expected_qty > 0 ? "+" : ""}${item.counted_qty - item.expected_qty})`,
          resolved: false,
        }));

        await supabase.from("alerts").insert(alerts);
      }

      router.push(`/stock-check/${stockCheck.id}`);
    } catch (err) {
      console.error("Submit error:", err);
      setSubmitError("Failed to save stock check. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 0:
        return !!selectedVendorId;
      case 1:
        return scanMode !== null && countItems.length > 0;
      case 2:
        return true;
      default:
        return false;
    }
  }

  function handleNext() {
    if (currentStep === 1 && cameraActive) {
      stopCamera();
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
    if (currentStep === 3) {
      handleSubmit();
    }
  }

  function handleBack() {
    if (currentStep === 1 && cameraActive) {
      stopCamera();
    }
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  return (
    <div className="max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/stock-check")}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Stock Check</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {selectedVendor
              ? `Checking ${selectedVendor.name}`
              : "Verify inventory at a vendor location"}
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-1 mb-8 px-2">
        {STEPS.map((step, index) => (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  index < currentStep
                    ? "bg-green-500 text-white"
                    : index === currentStep
                      ? "bg-primary-600 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {index < currentStep ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`text-xs mt-1 text-center ${
                  index <= currentStep
                    ? "text-gray-900 font-medium"
                    : "text-gray-400"
                }`}
              >
                {step}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 rounded ${
                  index < currentStep ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {/* STEP 0: Select Vendor */}
        {currentStep === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Select Vendor
            </h2>
            {vendorsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {vendors.map((vendor) => (
                  <button
                    key={vendor.id}
                    onClick={() => setSelectedVendorId(vendor.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                      selectedVendorId === vendor.id
                        ? "border-primary-500 bg-primary-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="font-medium text-gray-900">{vendor.name}</p>
                    {vendor.address && (
                      <p className="text-sm text-gray-500 mt-0.5">
                        {vendor.address}
                      </p>
                    )}
                  </button>
                ))}
                {vendors.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    No vendors found. Add a vendor first.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 1: Count Items */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Count Items
            </h2>

            {/* Scan Mode Selector */}
            {!scanMode && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => setScanMode("manual")}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                >
                  <ClipboardList className="w-8 h-8 text-primary-600" />
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">Manual Entry</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter counts for each SKU
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setScanMode("camera");
                    // Delay to let the video element render
                    setTimeout(startCamera, 100);
                  }}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                >
                  <Camera className="w-8 h-8 text-primary-600" />
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">Camera Scan</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Scan barcodes with camera
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setScanMode("ai-batch")}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-primary-600" />
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">AI Batch Scan</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Upload a photo for AI counting
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* Mode indicator + change button */}
            {scanMode && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {scanMode === "manual" && (
                    <ClipboardList className="w-4 h-4" />
                  )}
                  {scanMode === "camera" && <Camera className="w-4 h-4" />}
                  {scanMode === "ai-batch" && <Upload className="w-4 h-4" />}
                  <span className="font-medium capitalize">
                    {scanMode === "ai-batch"
                      ? "AI Batch Scan"
                      : scanMode === "camera"
                        ? "Camera Scan"
                        : "Manual Entry"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (cameraActive) stopCamera();
                    setScanMode(null);
                  }}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Change mode
                </button>
              </div>
            )}

            {/* Manual Entry Mode */}
            {scanMode === "manual" && (
              <div>
                {skusLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                  </div>
                ) : countItems.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No SKUs assigned to this vendor.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {countItems.map((item) => (
                      <div
                        key={item.sku_id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {item.sku_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.sku_code} &middot; Expected:{" "}
                            <span className="font-medium">
                              {item.expected_qty}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCount(item.sku_id, -1)}
                            className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5 text-gray-600" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={item.counted_qty}
                            onChange={(e) =>
                              setCount(
                                item.sku_id,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-16 text-center px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                          <button
                            onClick={() => updateCount(item.sku_id, 1)}
                            className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Camera Scan Mode */}
            {scanMode === "camera" && (
              <div className="space-y-4">
                {/* Camera Preview */}
                <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
                      <Camera className="w-10 h-10 opacity-50" />
                      <button
                        onClick={startCamera}
                        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Start Camera
                      </button>
                    </div>
                  )}
                  {cameraActive && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <ScanLine className="w-48 h-48 text-primary-400 opacity-50" />
                    </div>
                  )}
                </div>

                {/* SKU Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter or confirm SKU code..."
                    value={cameraSku}
                    onChange={(e) => setCameraSku(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCameraScan()}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    onClick={handleCameraScan}
                    disabled={!cameraSku.trim()}
                    className="px-4 py-3 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Scanned items count */}
                {countItems.some((i) => i.counted_qty > 0) && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Scanned Items
                    </p>
                    <div className="space-y-1">
                      {countItems
                        .filter((i) => i.counted_qty > 0)
                        .map((item) => (
                          <div
                            key={item.sku_id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-gray-600">
                              {item.sku_code} - {item.sku_name}
                            </span>
                            <span className="font-medium text-gray-900">
                              x{item.counted_qty}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Batch Scan Mode */}
            {scanMode === "ai-batch" && (
              <div className="space-y-4">
                {/* Upload Area */}
                {!uploadedImage ? (
                  <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors">
                    <ImageIcon className="w-10 h-10 text-gray-400" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">
                        Upload shelf photo
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        JPG, PNG up to 10MB
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="space-y-3">
                    {/* Image Preview */}
                    <div className="relative rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={uploadedImage}
                        alt="Uploaded shelf photo"
                        className="w-full max-h-64 object-contain bg-gray-50"
                      />
                      <button
                        onClick={() => {
                          setUploadedImage(null);
                          setUploadedFile(null);
                          setAiResults(null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg shadow-sm hover:bg-white transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>

                    {/* Analyze Button */}
                    <button
                      onClick={handleAiAnalyze}
                      disabled={aiAnalyzing}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      {aiAnalyzing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <ScanLine className="w-4 h-4" />
                          Analyze with AI
                        </>
                      )}
                    </button>

                    {/* AI Results */}
                    {aiResults && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-800">{aiResults}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Review */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Review Stock Count
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Verify all counts before submitting. Discrepancies are highlighted.
            </p>

            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">
                  {countItems.length}
                </p>
                <p className="text-xs text-gray-500">Total Items</p>
              </div>
              <div
                className={`rounded-lg p-3 text-center ${discrepancies.length > 0 ? "bg-red-50" : "bg-green-50"}`}
              >
                <p
                  className={`text-2xl font-bold ${discrepancies.length > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {discrepancies.length}
                </p>
                <p className="text-xs text-gray-500">Discrepancies</p>
              </div>
              <div
                className={`rounded-lg p-3 text-center ${totalDiscrepancy !== 0 ? "bg-red-50" : "bg-green-50"}`}
              >
                <p
                  className={`text-2xl font-bold ${totalDiscrepancy !== 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {totalDiscrepancy > 0 ? "+" : ""}
                  {totalDiscrepancy}
                </p>
                <p className="text-xs text-gray-500">Net Difference</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <div className="col-span-5">Item</div>
                <div className="col-span-2 text-right">Expected</div>
                <div className="col-span-2 text-right">Counted</div>
                <div className="col-span-3 text-right">Diff</div>
              </div>
              {/* Table Rows */}
              <div className="divide-y divide-gray-100">
                {countItems.map((item) => {
                  const diff = item.counted_qty - item.expected_qty;
                  const hasDiscrepancy = diff !== 0;
                  return (
                    <div
                      key={item.sku_id}
                      className={`grid grid-cols-12 gap-2 px-3 py-2.5 text-sm ${
                        hasDiscrepancy ? "bg-red-50" : ""
                      }`}
                    >
                      <div className="col-span-5 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {item.sku_name}
                        </p>
                        <p className="text-xs text-gray-500">{item.sku_code}</p>
                      </div>
                      <div className="col-span-2 text-right text-gray-600 self-center">
                        {item.expected_qty}
                      </div>
                      <div className="col-span-2 text-right font-medium text-gray-900 self-center">
                        {item.counted_qty}
                      </div>
                      <div
                        className={`col-span-3 text-right font-semibold self-center ${
                          hasDiscrepancy ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {hasDiscrepancy ? (
                          <span className="flex items-center justify-end gap-1">
                            {diff > 0 ? "+" : ""}
                            {diff}
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="flex items-center justify-end gap-1">
                            <Check className="w-3.5 h-3.5" />
                            OK
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any observations, notes about damages, etc."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>
          </div>
        )}

        {/* STEP 3: Submit */}
        {currentStep === 3 && (
          <div className="text-center py-6">
            {submitting ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
                <p className="text-gray-600 font-medium">
                  Saving stock check...
                </p>
              </div>
            ) : submitError ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <p className="text-red-600 font-medium">{submitError}</p>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Ready to Submit
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {countItems.length} items counted for{" "}
                    {selectedVendor?.name ?? "vendor"}
                  </p>
                  {discrepancies.length > 0 && (
                    <p className="text-sm text-amber-600 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                      {discrepancies.length} discrepanc
                      {discrepancies.length === 1 ? "y" : "ies"} will generate
                      alerts
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSubmit}
                  className="px-8 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                >
                  Confirm &amp; Submit
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      {currentStep < 3 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 lg:static lg:bg-transparent lg:border-0 lg:p-0 lg:mt-4">
          <div className="max-w-2xl mx-auto flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium rounded-lg transition-colors ${
                canProceed()
                  ? "bg-primary-600 text-white hover:bg-primary-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {currentStep === 2 ? "Review & Submit" : "Next"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
