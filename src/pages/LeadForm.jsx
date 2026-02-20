import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Save, Trash2 } from 'lucide-react';
import { STAGES, SOURCES } from '../utils/constants';
import { getLeads } from '../utils/storage';

const emptyLead = {
  company: '',
  contact: '',
  email: '',
  phone: '',
  dealValue: '',
  stage: 'new',
  source: 'Website',
  notes: '',
  followUpDate: '',
};

export default function LeadForm({ onSave, onDelete }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(emptyLead);

  useEffect(() => {
    if (id) {
      const lead = getLeads().find((l) => l.id === id);
      if (lead) {
        setForm({
          ...lead,
          dealValue: lead.dealValue?.toString() || '',
          followUpDate: lead.followUpDate || '',
        });
      }
    }
  }, [id]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      id: form.id || uuidv4(),
      dealValue: form.dealValue ? parseFloat(form.dealValue) : 0,
    });
    navigate('/leads');
  };

  const handleDelete = () => {
    if (window.confirm('Delete this lead?')) {
      onDelete(id);
      navigate('/leads');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        {isEdit ? 'Edit Lead' : 'Add New Lead'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Company */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
          <input
            name="company"
            value={form.company}
            onChange={handleChange}
            required
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            placeholder="Acme Inc."
          />
        </div>

        {/* Contact */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person *</label>
          <input
            name="contact"
            value={form.contact}
            onChange={handleChange}
            required
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            placeholder="John Doe"
          />
        </div>

        {/* Email & Phone row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="john@acme.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              placeholder="+65 9123 4567"
            />
          </div>
        </div>

        {/* Deal Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deal Value ($)</label>
          <input
            name="dealValue"
            type="number"
            min="0"
            step="0.01"
            value={form.dealValue}
            onChange={handleChange}
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            placeholder="10000"
          />
        </div>

        {/* Stage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
          <select
            name="stage"
            value={form.stage}
            onChange={handleChange}
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          >
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Source */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lead Source</label>
          <select
            name="source"
            value={form.source}
            onChange={handleChange}
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Follow-up Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
          <input
            name="followUpDate"
            type="date"
            value={form.followUpDate}
            onChange={handleChange}
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
            placeholder="Meeting notes, requirements, etc."
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-light transition-colors"
          >
            <Save size={18} />
            {isEdit ? 'Update Lead' : 'Save Lead'}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center justify-center gap-2 bg-danger text-white px-5 py-3 rounded-lg font-medium hover:opacity-90 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
