import { useState, useRef } from 'react';
import { Sparkles, Copy, ExternalLink, Loader2, Send, RefreshCw } from 'lucide-react';
import { getStageLabel } from '../utils/constants';

const EMAIL_TYPES = [
  { key: 'introduction', label: 'Introduction' },
  { key: 'followup', label: 'Follow-up' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'meeting', label: 'Meeting Request' },
  { key: 'thankyou', label: 'Thank You' },
  { key: 'closing', label: 'Deal Closing' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function AIEmail({ leads }) {
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [emailType, setEmailType] = useState('introduction');
  const [customInstructions, setCustomInstructions] = useState('');
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  const handleGenerate = async () => {
    if (!selectedLead) return;

    setLoading(true);
    setGeneratedEmail('');
    setError('');
    setCopied(false);

    try {
      abortRef.current = new AbortController();

      const res = await fetch(`${API_URL}/api/craft-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: selectedLead,
          emailType,
          customInstructions: customInstructions.trim() || undefined,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            if (payload === '[DONE]') break;
            try {
              const { text } = JSON.parse(payload);
              setGeneratedEmail((prev) => prev + text);
            } catch {
              // skip malformed chunks
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to generate email');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMailto = () => {
    if (!selectedLead?.email) return;
    const lines = generatedEmail.split('\n');
    const subjectLine = lines[0]?.replace(/^Subject:\s*/i, '') || '';
    const body = lines.slice(1).join('\n').trim();
    const mailto = `mailto:${encodeURIComponent(selectedLead.email)}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;
    window.open(mailto);
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  const activeLeads = leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={22} className="text-primary" />
        <h2 className="text-xl font-bold text-gray-800">AI Email Agent</h2>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
        {/* Lead Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Lead
          </label>
          <select
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="">Choose a lead...</option>
            {activeLeads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.contact} — {lead.company} ({getStageLabel(lead.stage)})
              </option>
            ))}
          </select>
        </div>

        {/* Lead Summary */}
        {selectedLead && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-1">
            <p><span className="font-medium text-gray-800">Company:</span> {selectedLead.company}</p>
            <p><span className="font-medium text-gray-800">Contact:</span> {selectedLead.contact}</p>
            {selectedLead.email && <p><span className="font-medium text-gray-800">Email:</span> {selectedLead.email}</p>}
            {selectedLead.value && <p><span className="font-medium text-gray-800">Deal Value:</span> ${Number(selectedLead.value).toLocaleString()}</p>}
            <p><span className="font-medium text-gray-800">Stage:</span> {getStageLabel(selectedLead.stage)}</p>
            {selectedLead.notes && <p><span className="font-medium text-gray-800">Notes:</span> {selectedLead.notes}</p>}
          </div>
        )}

        {/* Email Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Type
          </label>
          <div className="flex flex-wrap gap-2">
            {EMAIL_TYPES.map((type) => (
              <button
                key={type.key}
                onClick={() => setEmailType(type.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  emailType === type.key
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custom Instructions <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="e.g., Mention our new product launch, keep tone casual..."
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={loading ? handleStop : handleGenerate}
          disabled={!selectedLeadId && !loading}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            loading
              ? 'bg-danger text-white hover:bg-red-600'
              : !selectedLeadId
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-primary text-white hover:bg-primary-light'
          }`}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Stop Generating
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Generate Email
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm border border-red-100">
          {error}
        </div>
      )}

      {/* Generated Email */}
      {generatedEmail && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Generated Email</h3>
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                title="Regenerate"
              >
                <RefreshCw size={14} />
                Redo
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <Copy size={14} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
              {selectedLead?.email && (
                <button
                  onClick={handleMailto}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-light transition-colors"
                >
                  <Send size={14} />
                  Send
                </button>
              )}
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-100">
            {generatedEmail}
          </pre>
        </div>
      )}
    </div>
  );
}
