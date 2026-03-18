import { useState, useMemo, useRef } from 'react';
import {
  Search,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  Package,
  FileSpreadsheet,
  X,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';

const TEMPLATE_COLUMNS = [
  'sku_code',
  'product_name',
  'description',
  'unit',
  'quantity',
  'low_stock_threshold',
];

export default function SkuList({ skus, onUpsert, onDelete }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('sku_code');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSku, setNewSku] = useState({
    sku_code: '',
    product_name: '',
    description: '',
    unit: 'pcs',
    quantity: 0,
    low_stock_threshold: 10,
  });
  const fileInputRef = useRef(null);

  const filtered = useMemo(() => {
    let result = [...skus];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.sku_code?.toLowerCase().includes(q) ||
          s.product_name?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'quantity') return (a.quantity || 0) - (b.quantity || 0);
      if (sortBy === 'product_name') return (a.product_name || '').localeCompare(b.product_name || '');
      return (a.sku_code || '').localeCompare(b.sku_code || '');
    });

    return result;
  }, [skus, search, sortBy]);

  const lowStockCount = useMemo(
    () => skus.filter((s) => s.quantity <= (s.low_stock_threshold || 0)).length,
    [skus]
  );

  // --- Import ---
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          alert('File is empty or has no valid data rows.');
          return;
        }

        const count = onUpsert(rows).length;
        alert(`Imported ${rows.length} row(s). Total SKUs: ${count}`);
      } catch (err) {
        alert('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // --- Export all SKUs ---
  const handleExport = () => {
    const data = skus.map((s) => ({
      sku_code: s.sku_code,
      product_name: s.product_name,
      description: s.description,
      unit: s.unit,
      quantity: s.quantity,
      low_stock_threshold: s.low_stock_threshold,
      vendor_id: s.vendor_id || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 8 }, { wch: 10 }, { wch: 18 }, { wch: 15 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKUs');
    XLSX.writeFile(wb, `skus-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // --- Download template ---
  const handleDownloadTemplate = () => {
    const sampleRow = {
      sku_code: 'SKU-001',
      product_name: 'Sample Product',
      description: 'Product description',
      unit: 'pcs',
      quantity: 100,
      low_stock_threshold: 10,
    };
    const ws = XLSX.utils.json_to_sheet([sampleRow], { header: TEMPLATE_COLUMNS });
    ws['!cols'] = [
      { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 8 }, { wch: 10 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'sku-import-template.xlsx');
  };

  // --- Inline edit ---
  const startEdit = (sku) => {
    setEditingId(sku.id);
    setEditForm({ ...sku });
  };

  const saveEdit = () => {
    onUpsert([editForm]);
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // --- Add new SKU ---
  const handleAdd = () => {
    if (!newSku.sku_code.trim()) {
      alert('SKU code is required.');
      return;
    }
    onUpsert([newSku]);
    setNewSku({ sku_code: '', product_name: '', description: '', unit: 'pcs', quantity: 0, low_stock_threshold: 10 });
    setShowAddModal(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">SKU Tracker</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {skus.length} items{lowStockCount > 0 && (
              <span className="text-amber-600 ml-2">
                <AlertTriangle size={12} className="inline -mt-0.5" /> {lowStockCount} low stock
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-light transition-colors"
        >
          <Plus size={14} /> Add SKU
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
        >
          <Upload size={14} /> Import
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
          disabled={skus.length === 0}
        >
          <Download size={14} /> Export
        </button>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
        >
          <FileSpreadsheet size={14} /> Template
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {/* Search & Sort */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, product name..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 outline-none"
        >
          <option value="sku_code">SKU Code</option>
          <option value="product_name">Product Name</option>
          <option value="quantity">Quantity (low first)</option>
        </select>
      </div>

      {/* SKU Table / Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package size={40} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No SKUs found</p>
          <p className="text-xs mt-1">Add items or import from a spreadsheet</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500 text-xs uppercase">
                  <th className="py-2 px-3">SKU Code</th>
                  <th className="py-2 px-3">Product Name</th>
                  <th className="py-2 px-3">Unit</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3 text-right">Low Threshold</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sku) => {
                  const isLow = sku.quantity <= (sku.low_stock_threshold || 0);
                  const isEditing = editingId === sku.id;

                  return (
                    <tr key={sku.id} className={`border-b border-gray-100 ${isLow ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                      <td className="py-2.5 px-3 font-mono text-xs font-medium">{sku.sku_code}</td>
                      <td className="py-2.5 px-3">
                        {isEditing ? (
                          <input
                            value={editForm.product_name}
                            onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        ) : (
                          sku.product_name
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">{isEditing ? (
                        <input
                          value={editForm.unit}
                          onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                          className="w-16 px-2 py-1 border rounded text-sm"
                        />
                      ) : sku.unit}</td>
                      <td className="py-2.5 px-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.quantity}
                            onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                            className="w-20 px-2 py-1 border rounded text-sm text-right"
                          />
                        ) : (
                          <span className={isLow ? 'text-amber-600 font-semibold' : ''}>
                            {sku.quantity}
                            {isLow && <AlertTriangle size={12} className="inline ml-1 -mt-0.5" />}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-500">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.low_stock_threshold}
                            onChange={(e) => setEditForm({ ...editForm, low_stock_threshold: Number(e.target.value) })}
                            className="w-20 px-2 py-1 border rounded text-sm text-right"
                          />
                        ) : (
                          sku.low_stock_threshold
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                            <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => startEdit(sku)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded"><Edit3 size={14} /></button>
                            <button onClick={() => { if (confirm('Delete this SKU?')) onDelete(sku.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((sku) => {
              const isLow = sku.quantity <= (sku.low_stock_threshold || 0);
              return (
                <div key={sku.id} className={`bg-white rounded-xl p-4 shadow-sm border ${isLow ? 'border-amber-200 bg-amber-50' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{sku.sku_code}</span>
                      <h3 className="font-semibold text-gray-800 mt-1">{sku.product_name}</h3>
                      {sku.description && <p className="text-xs text-gray-500 mt-0.5">{sku.description}</p>}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button onClick={() => startEdit(sku)} className="p-1.5 text-gray-400 hover:text-primary rounded"><Edit3 size={14} /></button>
                      <button onClick={() => { if (confirm('Delete this SKU?')) onDelete(sku.id); }} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{sku.unit}</span>
                    <span className={`font-semibold ${isLow ? 'text-amber-600' : 'text-gray-800'}`}>
                      Qty: {sku.quantity}
                      {isLow && <AlertTriangle size={12} className="inline ml-1 -mt-0.5" />}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add SKU Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-800">Add New SKU</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SKU Code *</label>
                <input
                  value={newSku.sku_code}
                  onChange={(e) => setNewSku({ ...newSku, sku_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="e.g. SKU-001"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Product Name</label>
                <input
                  value={newSku.product_name}
                  onChange={(e) => setNewSku({ ...newSku, product_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="Product name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input
                  value={newSku.description}
                  onChange={(e) => setNewSku({ ...newSku, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  placeholder="Optional description"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                  <input
                    value={newSku.unit}
                    onChange={(e) => setNewSku({ ...newSku, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={newSku.quantity}
                    onChange={(e) => setNewSku({ ...newSku, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Low Threshold</label>
                  <input
                    type="number"
                    value={newSku.low_stock_threshold}
                    onChange={(e) => setNewSku({ ...newSku, low_stock_threshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleAdd}
              className="w-full mt-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
            >
              Add SKU
            </button>
          </div>
        </div>
      )}

      {/* Inline edit modal for mobile */}
      {editingId && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={cancelEdit}>
          <div className="bg-white rounded-t-2xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-800">Edit SKU</h3>
              <button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Product Name</label>
                <input
                  value={editForm.product_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                  <input
                    value={editForm.unit || ''}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={editForm.quantity ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Low Threshold</label>
                  <input
                    type="number"
                    value={editForm.low_stock_threshold ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, low_stock_threshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={saveEdit}
              className="w-full mt-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
