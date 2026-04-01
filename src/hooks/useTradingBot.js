import { useState, useEffect, useRef, useCallback } from 'react';

const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', basePrice: 65000, volatility: 0.02 },
  { symbol: 'ETH', name: 'Ethereum', basePrice: 3200, volatility: 0.025 },
  { symbol: 'AAPL', name: 'Apple', basePrice: 185, volatility: 0.01 },
  { symbol: 'TSLA', name: 'Tesla', basePrice: 240, volatility: 0.018 },
];

const STRATEGIES = {
  MA_CROSSOVER: 'MA Crossover',
  RSI: 'RSI Mean Reversion',
  MOMENTUM: 'Momentum',
};

const INITIAL_CAPITAL = 10000;
const TICK_INTERVAL = 1500; // ms

function generatePriceHistory(basePrice, volatility, count = 50) {
  const prices = [basePrice];
  for (let i = 1; i < count; i++) {
    const change = prices[i - 1] * volatility * (Math.random() * 2 - 1);
    prices.push(Math.max(prices[i - 1] + change, basePrice * 0.5));
  }
  return prices;
}

function calcSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  const changes = prices.slice(-period - 1).map((p, i, arr) => (i > 0 ? p - arr[i - 1] : 0)).slice(1);
  const gains = changes.map((c) => (c > 0 ? c : 0));
  const losses = changes.map((c) => (c < 0 ? Math.abs(c) : 0));
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function getSignal(strategy, prices, params) {
  const price = prices[prices.length - 1];

  if (strategy === 'MA_CROSSOVER') {
    const fast = calcSMA(prices, params.fastPeriod || 5);
    const slow = calcSMA(prices, params.slowPeriod || 20);
    if (!fast || !slow) return 'HOLD';
    const prevFast = calcSMA(prices.slice(0, -1), params.fastPeriod || 5);
    const prevSlow = calcSMA(prices.slice(0, -1), params.slowPeriod || 20);
    if (!prevFast || !prevSlow) return 'HOLD';
    if (prevFast <= prevSlow && fast > slow) return 'BUY';
    if (prevFast >= prevSlow && fast < slow) return 'SELL';
    return 'HOLD';
  }

  if (strategy === 'RSI') {
    const rsi = calcRSI(prices, params.rsiPeriod || 14);
    if (!rsi) return 'HOLD';
    if (rsi < (params.oversold || 30)) return 'BUY';
    if (rsi > (params.overbought || 70)) return 'SELL';
    return 'HOLD';
  }

  if (strategy === 'MOMENTUM') {
    const lookback = params.lookback || 10;
    if (prices.length < lookback + 1) return 'HOLD';
    const momentum = (price / prices[prices.length - 1 - lookback] - 1) * 100;
    if (momentum > (params.buyThreshold || 2)) return 'BUY';
    if (momentum < -(params.sellThreshold || 2)) return 'SELL';
    return 'HOLD';
  }

  return 'HOLD';
}

export function useTradingBot() {
  const [isRunning, setIsRunning] = useState(false);
  const [strategy, setStrategy] = useState('MA_CROSSOVER');
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [params, setParams] = useState({ fastPeriod: 5, slowPeriod: 20, rsiPeriod: 14, oversold: 30, overbought: 70, lookback: 10, buyThreshold: 2, sellThreshold: 2 });
  const [riskPerTrade, setRiskPerTrade] = useState(10); // % of capital
  const [cash, setCash] = useState(INITIAL_CAPITAL);
  const [positions, setPositions] = useState({});
  const [trades, setTrades] = useState([]);
  const [priceHistory, setPriceHistory] = useState(() => {
    const init = {};
    ASSETS.forEach((a) => { init[a.symbol] = generatePriceHistory(a.basePrice, a.volatility); });
    return init;
  });
  const [metrics, setMetrics] = useState({ totalReturn: 0, winRate: 0, totalTrades: 0, portfolioValue: INITIAL_CAPITAL });

  const stateRef = useRef({ cash, positions, trades, priceHistory, strategy, params, riskPerTrade, selectedAsset });
  useEffect(() => { stateRef.current = { cash, positions, trades, priceHistory, strategy, params, riskPerTrade, selectedAsset }; }, [cash, positions, trades, priceHistory, strategy, params, riskPerTrade, selectedAsset]);

  const tick = useCallback(() => {
    const { cash: curCash, positions: curPos, trades: curTrades, priceHistory: curHistory, strategy: curStrat, params: curParams, riskPerTrade: curRisk, selectedAsset: curAsset } = stateRef.current;

    // Update prices for all assets
    const newHistory = {};
    ASSETS.forEach((asset) => {
      const hist = curHistory[asset.symbol];
      const last = hist[hist.length - 1];
      const change = last * asset.volatility * (Math.random() * 2 - 1);
      const newPrice = Math.max(last + change, asset.basePrice * 0.3);
      newHistory[asset.symbol] = [...hist.slice(-99), newPrice];
    });

    // Run strategy on selected asset
    const assetPrices = newHistory[curAsset];
    const currentPrice = assetPrices[assetPrices.length - 1];
    const signal = getSignal(curStrat, assetPrices, curParams);

    let newCash = curCash;
    const newPos = { ...curPos };
    const newTrades = [...curTrades];

    if (signal === 'BUY' && !newPos[curAsset]) {
      const tradeValue = newCash * (curRisk / 100);
      const qty = tradeValue / currentPrice;
      if (qty > 0 && newCash >= tradeValue) {
        newCash -= tradeValue;
        newPos[curAsset] = { qty, entryPrice: currentPrice, entryTime: Date.now() };
        newTrades.unshift({ id: Date.now(), type: 'BUY', asset: curAsset, price: currentPrice, qty, value: tradeValue, time: new Date().toLocaleTimeString(), pnl: null });
      }
    } else if (signal === 'SELL' && newPos[curAsset]) {
      const pos = newPos[curAsset];
      const saleValue = pos.qty * currentPrice;
      const pnl = saleValue - pos.qty * pos.entryPrice;
      newCash += saleValue;
      delete newPos[curAsset];
      newTrades.unshift({ id: Date.now(), type: 'SELL', asset: curAsset, price: currentPrice, qty: pos.qty, value: saleValue, time: new Date().toLocaleTimeString(), pnl });
    }

    // Calculate portfolio value
    let positionsValue = 0;
    Object.entries(newPos).forEach(([sym, pos]) => {
      const price = newHistory[sym][newHistory[sym].length - 1];
      positionsValue += pos.qty * price;
    });
    const portfolioValue = newCash + positionsValue;
    const closedTrades = newTrades.filter((t) => t.pnl !== null);
    const wins = closedTrades.filter((t) => t.pnl > 0).length;
    const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;

    setPriceHistory(newHistory);
    setCash(newCash);
    setPositions(newPos);
    setTrades(newTrades.slice(0, 100));
    setMetrics({ totalReturn: ((portfolioValue - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100, winRate, totalTrades: closedTrades.length, portfolioValue });
  }, []);

  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(tick, TICK_INTERVAL);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, tick]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setCash(INITIAL_CAPITAL);
    setPositions({});
    setTrades([]);
    setMetrics({ totalReturn: 0, winRate: 0, totalTrades: 0, portfolioValue: INITIAL_CAPITAL });
    setPriceHistory(() => {
      const init = {};
      ASSETS.forEach((a) => { init[a.symbol] = generatePriceHistory(a.basePrice, a.volatility); });
      return init;
    });
  }, []);

  const closePosition = useCallback((symbol) => {
    const { cash: curCash, positions: curPos, trades: curTrades, priceHistory: curHistory } = stateRef.current;
    const pos = curPos[symbol];
    if (!pos) return;
    const price = curHistory[symbol][curHistory[symbol].length - 1];
    const saleValue = pos.qty * price;
    const pnl = saleValue - pos.qty * pos.entryPrice;
    const newPos = { ...curPos };
    delete newPos[symbol];
    const newTrade = { id: Date.now(), type: 'SELL', asset: symbol, price, qty: pos.qty, value: saleValue, time: new Date().toLocaleTimeString(), pnl };
    setCash(curCash + saleValue);
    setPositions(newPos);
    setTrades([newTrade, ...curTrades].slice(0, 100));
  }, []);

  return {
    isRunning, setIsRunning,
    strategy, setStrategy,
    selectedAsset, setSelectedAsset,
    params, setParams,
    riskPerTrade, setRiskPerTrade,
    cash, positions, trades, priceHistory,
    metrics, reset, closePosition,
    assets: ASSETS,
    strategies: STRATEGIES,
    initialCapital: INITIAL_CAPITAL,
  };
}
