import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import { Users, DollarSign, TrendingUp, AlertTriangle, Target, ArrowUpRight, Clock } from 'lucide-react';
import { STAGES, getStageColor, SOURCES } from '../utils/constants';
import StatCard from '../components/StatCard';
import { isPast, parseISO, differenceInDays } from 'date-fns';

export default function Dashboard({ leads }) {
  const stats = useMemo(() => {
    const activeLeads = leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost');
    const wonLeads = leads.filter((l) => l.stage === 'won');
    const lostLeads = leads.filter((l) => l.stage === 'lost');
    const totalPipeline = activeLeads.reduce((sum, l) => sum + (l.dealValue || 0), 0);
    const wonRevenue = wonLeads.reduce((sum, l) => sum + (l.dealValue || 0), 0);
    const closedCount = wonLeads.length + lostLeads.length;
    const winRate = closedCount > 0 ? ((wonLeads.length / closedCount) * 100).toFixed(0) : 0;
    const overdueFollowUps = activeLeads.filter(
      (l) => l.followUpDate && isPast(parseISO(l.followUpDate))
    );

    // Stage distribution
    const stageData = STAGES.map((s) => ({
      name: s.label,
      count: leads.filter((l) => l.stage === s.key).length,
      value: leads.filter((l) => l.stage === s.key).reduce((sum, l) => sum + (l.dealValue || 0), 0),
      color: s.color,
    })).filter((d) => d.count > 0);

    // Source distribution
    const sourceData = SOURCES.map((s) => ({
      name: s,
      count: leads.filter((l) => l.source === s).length,
    })).filter((d) => d.count > 0);

    // Conversion funnel (active stages only)
    const funnelStages = STAGES.filter((s) => s.key !== 'won' && s.key !== 'lost');
    const funnelData = funnelStages.map((s) => ({
      name: s.label,
      leads: leads.filter((l) => l.stage === s.key).length,
      fill: s.color,
    }));

    // Monthly trend (leads created per month)
    const monthlyMap = {};
    leads.forEach((l) => {
      if (l.createdAt) {
        const month = l.createdAt.substring(0, 7); // YYYY-MM
        monthlyMap[month] = (monthlyMap[month] || 0) + 1;
      }
    });
    const monthlyTrend = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, count]) => ({ month, leads: count }));

    // Improvement insights
    const insights = [];

    if (overdueFollowUps.length > 0) {
      insights.push({
        type: 'warning',
        icon: Clock,
        title: `${overdueFollowUps.length} Overdue Follow-up${overdueFollowUps.length > 1 ? 's' : ''}`,
        description: `You have leads waiting for follow-up. ${overdueFollowUps[0].company} is the most overdue.`,
        action: 'Review follow-ups',
      });
    }

    const newLeads = leads.filter((l) => l.stage === 'new');
    if (newLeads.length > 3) {
      insights.push({
        type: 'action',
        icon: Target,
        title: 'Too Many Uncontacted Leads',
        description: `${newLeads.length} leads are still in "New" stage. Prioritize outreach to prevent leads from going cold.`,
        action: 'Contact leads',
      });
    }

    const stuckInQualified = activeLeads.filter(
      (l) => l.stage === 'qualified' && l.createdAt && differenceInDays(new Date(), parseISO(l.createdAt)) > 14
    );
    if (stuckInQualified.length > 0) {
      insights.push({
        type: 'info',
        icon: AlertTriangle,
        title: 'Leads Stuck in Qualified',
        description: `${stuckInQualified.length} lead${stuckInQualified.length > 1 ? 's have' : ' has'} been qualified for 14+ days without advancing. Send proposals to move them forward.`,
        action: 'Send proposals',
      });
    }

    if (Number(winRate) < 30 && closedCount >= 3) {
      insights.push({
        type: 'warning',
        icon: TrendingUp,
        title: 'Low Win Rate',
        description: `Your win rate is ${winRate}%. Analyze lost deals to improve your approach. Consider qualifying leads more carefully.`,
        action: 'Review lost deals',
      });
    }

    const noValueLeads = activeLeads.filter((l) => !l.dealValue);
    if (noValueLeads.length > 2) {
      insights.push({
        type: 'info',
        icon: DollarSign,
        title: 'Missing Deal Values',
        description: `${noValueLeads.length} active leads have no deal value set. Add values to better forecast your pipeline.`,
        action: 'Update leads',
      });
    }

    if (insights.length === 0 && leads.length > 0) {
      insights.push({
        type: 'success',
        icon: TrendingUp,
        title: 'Looking Good!',
        description: 'No major issues detected. Keep up the momentum and stay on top of your follow-ups.',
      });
    }

    return {
      totalLeads: leads.length,
      activeLeads: activeLeads.length,
      totalPipeline,
      wonRevenue,
      winRate,
      overdueCount: overdueFollowUps.length,
      stageData,
      sourceData,
      funnelData,
      monthlyTrend,
      insights,
    };
  }, [leads]);

  if (leads.length === 0) {
    return (
      <div className="text-center py-16">
        <Users size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-600 mb-2">No leads yet</h2>
        <p className="text-sm text-gray-400 mb-4">Add your first lead to see your dashboard come to life.</p>
      </div>
    );
  }

  const insightColors = {
    warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    action: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
    info: { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },
    success: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="Active Leads" value={stats.activeLeads} color="#1e3a5f" />
        <StatCard icon={DollarSign} label="Pipeline Value" value={`$${(stats.totalPipeline / 1000).toFixed(0)}k`} color="#f59e0b" />
        <StatCard icon={TrendingUp} label="Win Rate" value={`${stats.winRate}%`} color="#10b981" />
        <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdueCount} color={stats.overdueCount > 0 ? '#ef4444' : '#10b981'} />
      </div>

      {/* Improvement Insights */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <ArrowUpRight size={16} />
          Areas to Improve
        </h3>
        <div className="space-y-2">
          {stats.insights.map((insight, i) => {
            const colors = insightColors[insight.type];
            return (
              <div
                key={i}
                className="rounded-xl p-3 border-l-4"
                style={{ backgroundColor: colors.bg, borderLeftColor: colors.border }}
              >
                <div className="flex items-start gap-2">
                  <insight.icon size={16} style={{ color: colors.text }} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: colors.text }}>{insight.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: colors.text, opacity: 0.8 }}>{insight.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Funnel */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Pipeline Funnel</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stats.funnelData} layout="vertical">
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="leads" radius={[0, 6, 6, 0]}>
              {stats.funnelData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stage Distribution (Pie) */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Stage Distribution</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={stats.stageData}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, count }) => `${name} (${count})`}
              labelLine={true}
            >
              {stats.stageData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [value, 'Leads']} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Deal Value by Stage */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Deal Value by Stage</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stats.stageData}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Value']} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {stats.stageData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Lead Source Breakdown */}
      {stats.sourceData.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Lead Sources</h3>
          <div className="space-y-2">
            {stats.sourceData
              .sort((a, b) => b.count - a.count)
              .map((source) => {
                const pct = ((source.count / leads.length) * 100).toFixed(0);
                return (
                  <div key={source.name} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-24 truncate">{source.name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">{source.count} ({pct}%)</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Monthly Trend */}
      {stats.monthlyTrend.length > 1 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Lead Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="leads" stroke="#1e3a5f" fill="#1e3a5f" fillOpacity={0.1} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary */}
      <div className="bg-primary-dark text-white rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-2">Pipeline Summary</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-300">Total Leads:</span>
          <span className="font-semibold text-right">{stats.totalLeads}</span>
          <span className="text-gray-300">Won Revenue:</span>
          <span className="font-semibold text-right">${stats.wonRevenue.toLocaleString()}</span>
          <span className="text-gray-300">Active Pipeline:</span>
          <span className="font-semibold text-right">${stats.totalPipeline.toLocaleString()}</span>
          <span className="text-gray-300">Win Rate:</span>
          <span className="font-semibold text-right">{stats.winRate}%</span>
        </div>
      </div>
    </div>
  );
}
