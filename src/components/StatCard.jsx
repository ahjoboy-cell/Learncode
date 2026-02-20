export default function StatCard({ icon: Icon, label, value, sub, color = '#1e3a5f' }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: color + '18' }}>
          <Icon size={20} style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
      {sub && <p className="text-xs text-gray-400 mt-2">{sub}</p>}
    </div>
  );
}
