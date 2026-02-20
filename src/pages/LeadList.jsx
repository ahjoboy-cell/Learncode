import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, ChevronRight, AlertCircle } from 'lucide-react';
import { STAGES } from '../utils/constants';
import StageBadge from '../components/StageBadge';
import StageBar from '../components/StageBar';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';

export default function LeadList({ leads }) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');

  const filtered = useMemo(() => {
    let result = [...leads];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.company?.toLowerCase().includes(q) ||
          l.contact?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q)
      );
    }

    // Stage filter
    if (stageFilter !== 'all') {
      result = result.filter((l) => l.stage === stageFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'dealValue') return (b.dealValue || 0) - (a.dealValue || 0);
      if (sortBy === 'company') return (a.company || '').localeCompare(b.company || '');
      return new Date(b[sortBy] || 0) - new Date(a[sortBy] || 0);
    });

    return result;
  }, [leads, search, stageFilter, sortBy]);

  const isOverdue = (lead) => lead.followUpDate && isPast(parseISO(lead.followUpDate)) && lead.stage !== 'won' && lead.stage !== 'lost';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Leads ({filtered.length})</h2>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, contact, email..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setStageFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              stageFilter === 'all' ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            All
          </button>
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStageFilter(s.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                stageFilter === s.key ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}
              style={stageFilter === s.key ? { backgroundColor: s.color } : {}}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 outline-none"
          >
            <option value="updatedAt">Recently Updated</option>
            <option value="createdAt">Date Created</option>
            <option value="dealValue">Deal Value</option>
            <option value="company">Company Name</option>
          </select>
        </div>
      </div>

      {/* Lead Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No leads found</p>
          <Link to="/leads/new" className="text-primary text-sm font-medium mt-2 inline-block">
            + Add your first lead
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <Link
              key={lead.id}
              to={`/leads/${lead.id}`}
              className="block bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800 truncate">{lead.company}</h3>
                    {isOverdue(lead) && (
                      <AlertCircle size={14} className="text-danger flex-shrink-0" title="Follow-up overdue" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{lead.contact}</p>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <StageBadge stage={lead.stage} />
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              </div>

              <StageBar currentStage={lead.stage} />

              <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span>
                  {lead.dealValue ? `$${lead.dealValue.toLocaleString()}` : 'No value'}
                </span>
                <span>{lead.source}</span>
                {lead.updatedAt && (
                  <span>{formatDistanceToNow(parseISO(lead.updatedAt), { addSuffix: true })}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
