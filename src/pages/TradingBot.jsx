import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Play, Square, RotateCcw, TrendingUp, TrendingDown, DollarSign, Activity, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useTradingBot } from '../hooks/useTradingBot';

function fmt(n, decimals = 2) {
  if (n === undefined || n === null) return '—';
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPrice(symbol, price) {
  if (symbol === 'BTC' || symbol === 'ETH') return `$${fmt(price, 2)}`;
  return `$${fmt(price, 2)}`;
}

function MetricCard({ label, value, sub, positive, icon: Icon }) {
  const color = positive === true ? 'text-green-600' : positive === false ? 'text-red-500' : 'text-gray-800';
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between text-gray-400 text-xs font-medium uppercase tracking-wide">
        <span>{label}</span>
        {Icon && <Icon size={14} />}
      </div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function PriceChart({ symbol, prices }) {
  const data = prices.map((price, i) => ({ i, price }));
  const first = data[0]?.price ?? 0;
  const last = data[data.length - 1]?.price ?? 0;
  const isUp = last >= first;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity={0.25} />
            <stop offset="95%" stopColor={isUp ? '#22c55e' : '#ef4444'} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="i" hide />
        <YAxis domain={['auto', 'auto']} hide />
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow">
                {fmtPrice(symbol, payload[0].value)}
              </div>
            ) : null
          }
        />
        <ReferenceLine y={first} stroke="#94a3b8" strokeDasharray="3 3" />
        <Area type="monotone" dataKey="price" stroke={isUp ? '#22c55e' : '#ef4444'} strokeWidth={2} fill="url(#priceGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function StrategyConfig({ strategy, params, setParams, strategies }) {
  const [open, setOpen] = useState(false);

  const fields =
    strategy === 'MA_CROSSOVER'
      ? [
          { key: 'fastPeriod', label: 'Fast MA Period', min: 2, max: 20 },
          { key: 'slowPeriod', label: 'Slow MA Period', min: 5, max: 50 },
        ]
      : strategy === 'RSI'
      ? [
          { key: 'rsiPeriod', label: 'RSI Period', min: 5, max: 30 },
          { key: 'oversold', label: 'Oversold Level', min: 10, max: 45 },
          { key: 'overbought', label: 'Overbought Level', min: 55, max: 90 },
        ]
      : [
          { key: 'lookback', label: 'Lookback Bars', min: 3, max: 30 },
          { key: 'buyThreshold', label: 'Buy Threshold %', min: 0.5, max: 10 },
          { key: 'sellThreshold', label: 'Sell Threshold %', min: 0.5, max: 10 },
        ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <button className="w-full flex items-center justify-between p-4 text-sm font-medium" onClick={() => setOpen((o) => !o)}>
        <span>Strategy Parameters</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-1 gap-3">
          {fields.map(({ key, label, min, max }) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">{label}</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={key.includes('Threshold') || key.includes('Period') && max <= 30 ? 1 : 1}
                  value={params[key] ?? min}
                  onChange={(e) => setParams((p) => ({ ...p, [key]: Number(e.target.value) }))}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-xs font-mono w-8 text-right">{params[key] ?? min}</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TradingBot() {
  const {
    isRunning, setIsRunning,
    strategy, setStrategy,
    selectedAsset, setSelectedAsset,
    params, setParams,
    riskPerTrade, setRiskPerTrade,
    cash, positions, trades, priceHistory,
    metrics, reset, closePosition,
    assets, strategies, initialCapital,
  } = useTradingBot();

  const currentPrices = {};
  assets.forEach((a) => {
    const hist = priceHistory[a.symbol];
    currentPrices[a.symbol] = hist[hist.length - 1];
  });

  const openPositionEntries = Object.entries(positions);

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Trading Bot</h1>
          <p className="text-xs text-gray-400">Paper trading simulation</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Reset"
          >
            <RotateCcw size={16} className="text-gray-500" />
          </button>
          <button
            onClick={() => setIsRunning((r) => !r)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isRunning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isRunning ? <><Square size={14} /> Stop</> : <><Play size={14} /> Start</>}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-2 ${isRunning ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
        <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        {isRunning ? `Running — ${strategies[strategy]} on ${selectedAsset}` : 'Stopped — configure and press Start'}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Portfolio Value"
          value={`$${fmt(metrics.portfolioValue)}`}
          sub={`Cash: $${fmt(cash)}`}
          icon={DollarSign}
        />
        <MetricCard
          label="Total Return"
          value={`${metrics.totalReturn >= 0 ? '+' : ''}${fmt(metrics.totalReturn)}%`}
          sub={`From $${fmt(initialCapital)}`}
          positive={metrics.totalReturn > 0 ? true : metrics.totalReturn < 0 ? false : undefined}
          icon={metrics.totalReturn >= 0 ? TrendingUp : TrendingDown}
        />
        <MetricCard
          label="Win Rate"
          value={`${fmt(metrics.winRate)}%`}
          sub={`${metrics.totalTrades} closed trades`}
          positive={metrics.winRate >= 50 ? true : metrics.totalTrades > 0 ? false : undefined}
          icon={Activity}
        />
        <MetricCard
          label="Open Positions"
          value={openPositionEntries.length}
          sub={openPositionEntries.map(([s]) => s).join(', ') || 'None'}
          icon={TrendingUp}
        />
      </div>

      {/* Price chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="font-semibold text-gray-900">{selectedAsset}</span>
            <span className="text-gray-400 text-sm ml-2">{assets.find((a) => a.symbol === selectedAsset)?.name}</span>
          </div>
          <span className={`text-lg font-bold ${(() => { const hist = priceHistory[selectedAsset]; return hist[hist.length - 1] >= hist[hist.length - 2] ? 'text-green-600' : 'text-red-500'; })()}`}>
            {fmtPrice(selectedAsset, currentPrices[selectedAsset])}
          </span>
        </div>
        <PriceChart symbol={selectedAsset} prices={priceHistory[selectedAsset]} />
        {/* Asset selector */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {assets.map((a) => (
            <button
              key={a.symbol}
              onClick={() => setSelectedAsset(a.symbol)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedAsset === a.symbol ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {a.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Configuration</h2>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Strategy</label>
          <div className="grid grid-cols-3 gap-1">
            {Object.entries(strategies).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStrategy(key)}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors text-center ${
                  strategy === key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Risk Per Trade: <strong>{riskPerTrade}%</strong> of capital</label>
          <input
            type="range"
            min={1}
            max={50}
            value={riskPerTrade}
            onChange={(e) => setRiskPerTrade(Number(e.target.value))}
            className="w-full accent-indigo-600"
          />
        </div>
      </div>

      <StrategyConfig strategy={strategy} params={params} setParams={setParams} strategies={strategies} />

      {/* Open Positions */}
      {openPositionEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Open Positions</h2>
          <div className="space-y-2">
            {openPositionEntries.map(([symbol, pos]) => {
              const currentPrice = currentPrices[symbol];
              const pnl = (currentPrice - pos.entryPrice) * pos.qty;
              const pnlPct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
              return (
                <div key={symbol} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-semibold text-sm text-gray-900">{symbol}</span>
                    <div className="text-xs text-gray-400">Entry: {fmtPrice(symbol, pos.entryPrice)} · Qty: {fmt(pos.qty, 4)}</div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <div className={`text-sm font-semibold ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {pnl >= 0 ? '+' : ''}${fmt(pnl)}
                      </div>
                      <div className={`text-xs ${pnl >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                        {pnlPct >= 0 ? '+' : ''}{fmt(pnlPct)}%
                      </div>
                    </div>
                    <button onClick={() => closePosition(symbol)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trade Log */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Trade Log</h2>
        {trades.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No trades yet. Start the bot to begin.</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {trades.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${t.type === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {t.type}
                  </span>
                  <span className="font-medium text-gray-700">{t.asset}</span>
                  <span className="text-gray-400">@ {fmtPrice(t.asset, t.price)}</span>
                </div>
                <div className="text-right">
                  {t.pnl !== null ? (
                    <span className={`font-medium ${t.pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {t.pnl >= 0 ? '+' : ''}${fmt(t.pnl)}
                    </span>
                  ) : (
                    <span className="text-gray-400">${fmt(t.value)}</span>
                  )}
                  <div className="text-gray-300">{t.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
