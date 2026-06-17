import React, { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [holdings, setHoldings] = useState([]);
  const [summaryAssets, setSummaryAssets] = useState([]);
  const [summaryLiabilities, setSummaryLiabilities] = useState([]);
  const [stats, setStats] = useState({ 
    totalInvested: 0, currentValue: 0, unrealisedPnL: 0, netWorth: 0 
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const SHEET_ID = '1F6xHrJnrChEmvop-YOIycodgd133IjBAtliDljFM2EA';
  const API_KEY = 'AIzaSyAqdKsVXtt1bhpptkV6Hm5tl1rvblivKHU';

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); 
    return () => clearInterval(interval);
  }, []);

  // Helper to safely parse numbers, ignoring ₹, commas, and % signs
  const parseSheetNumber = (val) => {
    if (!val) return 0;
    const cleanStr = val.toString().replace(/[₹,%\s]/g, '');
    return parseFloat(cleanStr) || 0;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Holdings and Summary concurrently
      const [holdingsRes, summaryRes] = await Promise.all([
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Holdings?key=${API_KEY}`),
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Summary?key=${API_KEY}`)
      ]);
      
      if (!holdingsRes.ok || !summaryRes.ok) {
        throw new Error('API Error: Ensure Sheet ID, API Key, and Sheet names are correct and the sheet is public.');
      }

      const holdingsData = await holdingsRes.json();
      const summaryData = await summaryRes.json();

      // 1. PARSE HOLDINGS & CALCULATE REAL P&L
      let calcTotalInvested = 0;
      let calcCurrentValue = 0;

      if (holdingsData.values && holdingsData.values.length > 1) {
        const holdingsRows = holdingsData.values.slice(1);
        const parsedHoldings = holdingsRows
          .filter(row => row[0]) 
          .map(row => {
            const quantity = parseSheetNumber(row[3]);     // Col D
            const avgPrice = parseSheetNumber(row[4]);     // Col E
            const currentPrice = parseSheetNumber(row[5]); // Col F

            // Force calculate Real P&L to guarantee accuracy
            const invested = quantity * avgPrice;
            const current = quantity * currentPrice;
            const pnl = current - invested;
            const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

            calcTotalInvested += invested;
            calcCurrentValue += current;

            return {
              symbol: row[0]?.toString() || '',
              sector: row[1]?.toString() || '',
              quantity,
              avgPrice,
              currentPrice,
              invested,
              current,
              pnl,
              pnlPercent,
              notes: row[10]?.toString() || '', // Col K
            };
          });

        setHoldings(parsedHoldings);
      }

      // 2. PARSE SUMMARY (Assets: C&D, Liabilities: G&H)
      let totalAssetsVal = 0;
      let totalLiabilitiesVal = 0;

      if (summaryData.values && summaryData.values.length > 1) {
        const summaryRows = summaryData.values.slice(1);
        const assets = [];
        const liabilities = [];

        summaryRows.forEach(row => {
          // Assets: Columns C & D (row[2] and row[3])
          if (row[2] && row[3]) {
            const name = row[2].toString().trim();
            const val = parseSheetNumber(row[3]);
            if (name.toLowerCase() !== 'total' && name !== '') {
              assets.push({ name, value: val });
              totalAssetsVal += val;
            }
          }

          // Liabilities/Credit Cards: Columns G & H (row[6] and row[7])
          if (row[6] && row[7]) {
            const name = row[6].toString().trim();
            const val = parseSheetNumber(row[7]);
            if (name.toLowerCase() !== 'total' && name !== '') {
              liabilities.push({ name, value: val });
              totalLiabilitiesVal += val;
            }
          }
        });

        setSummaryAssets(assets);
        setSummaryLiabilities(liabilities);
      }

      setStats({
        totalInvested: calcTotalInvested,
        currentValue: calcCurrentValue,
        unrealisedPnL: calcCurrentValue - calcTotalInvested,
        netWorth: totalAssetsVal - totalLiabilitiesVal
      });

      setLastUpdated(new Date().toLocaleString('en-IN'));
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
    return `₹${value.toFixed(0)}`;
  };

  const gainPercent = stats.totalInvested > 0 
    ? ((stats.unrealisedPnL / stats.totalInvested) * 100).toFixed(2)
    : 0;

  const sortedHoldings = [...holdings].sort((a, b) => b.current - a.current);

  return (
    <>
      <Head>
        <title>Portfolio Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{`
          /* Core Variables */
          :root {
            --bg: #0a0a0f;
            --bg2: #111118;
            --bg3: #18181f;
            --border: rgba(255,255,255,0.07);
            --text: #e8e8f0;
            --muted: #7a7a99;
            --accent: #f0b429;
            --accent2: #4ade80;
            --accent3: #f87171;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html { scroll-behavior: smooth; }
          body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; line-height: 1.6; }
          .container { max-width: 1400px; margin: 0 auto; padding: 0 24px; }
          
          /* Headers & Buttons */
          header { padding: 40px 0 30px; border-bottom: 1px solid var(--border); margin-bottom: 40px; }
          h1 { font-family: 'Playfair Display', serif; font-size: clamp(28px, 5vw, 48px); font-weight: 900; margin-bottom: 16px; }
          .header-controls { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
          .header-info { display: flex; gap: 24px; font-size: 12px; color: var(--muted); }
          .refresh-btn { background: var(--accent); color: var(--bg); border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
          .error-box { background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.3); color: #fca5a5; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
          
          /* Stats Grid */
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
          .stat-card { background: var(--bg3); border: 1px solid var(--border); border-radius: 12px; padding: 20px; position: relative; }
          .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--accent); transform: scaleX(0); transition: transform 0.2s; }
          .stat-card:hover::before { transform: scaleX(1); }
          .stat-card.green::before { background: var(--accent2); }
          .stat-card.red::before { background: var(--accent3); }
          .stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; }
          .stat-value { font-family: 'DM Mono', monospace; font-size: 22px; font-weight: 600; }
          .stat-value.green { color: var(--accent2); }
          .stat-value.red { color: var(--accent3); }
          .stat-value.gold { color: var(--accent); }
          .stat-sub { font-size: 11px; color: var(--muted); margin-top: 8px; }
          
          /* Split Summary Layout */
          .split-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
          @media (max-width: 768px) { .split-grid { grid-template-columns: 1fr; } }
          
          /* Tables */
          .table-wrapper { background: var(--bg3); border: 1px solid var(--border); border-radius: 12px; overflow-x: auto; margin-bottom: 32px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: var(--bg2); padding: 14px 16px; text-align: left; font-size: 11px; color: var(--muted); text-transform: uppercase; border-bottom: 1px solid var(--border); }
          td { padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
          .mono { font-family: 'DM Mono', monospace; }
          .text-green { color: var(--accent2); }
          .text-red { color: var(--accent3); }
          
          /* Typography */
          section { padding: 32px 0; border-bottom: 1px solid var(--border); }
          section:last-child { border-bottom: none; }
          section h2 { font-family: 'Playfair Display', serif; font-size: 24px; margin-bottom: 24px; }
        `}</style>
      </Head>

      <div className="container">
        <header>
          <h1>📈 Portfolio Dashboard</h1>
          <div className="header-controls">
            <div className="header-info">
              <span>Last Updated: {lastUpdated || 'Never'}</span>
              <span>Auto-refresh: Every 5 mins</span>
            </div>
            <button className="refresh-btn" onClick={fetchData} disabled={loading}>
              {loading ? 'Refreshing...' : '🔄 Refresh Now'}
            </button>
          </div>
        </header>

        {error && <div className="error-box">⚠️ <strong>Error:</strong> {error}</div>}

        {!loading && (
          <>
            {/* TOP STATS */}
            <section style={{ paddingTop: 0 }}>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Invested (Holdings)</div>
                  <div className="stat-value gold">{formatCurrency(stats.totalInvested)}</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Current Value (Holdings)</div>
                  <div className="stat-value">{formatCurrency(stats.currentValue)}</div>
                </div>

                <div className={`stat-card ${stats.unrealisedPnL >= 0 ? 'green' : 'red'}`}>
                  <div className="stat-label">Unrealised P&L</div>
                  <div className={`stat-value ${stats.unrealisedPnL >= 0 ? 'green' : 'red'}`}>
                    {stats.unrealisedPnL >= 0 ? '+' : ''}{formatCurrency(stats.unrealisedPnL)}
                  </div>
                  <div className="stat-sub">{gainPercent}% return</div>
                </div>

                <div className={`stat-card ${stats.netWorth >= 0 ? 'green' : 'red'}`}>
                  <div className="stat-label">Estimated Net Worth</div>
                  <div className={`stat-value ${stats.netWorth >= 0 ? 'green' : 'red'}`}>
                    {formatCurrency(stats.netWorth)}
                  </div>
                  <div className="stat-sub">Assets minus Liabilities</div>
                </div>
              </div>
            </section>

            {/* SPLIT SUMMARY SECTION */}
            <section>
              <h2>Financial Summary</h2>
              <div className="split-grid">
                {/* Assets Column */}
                <div className="table-wrapper" style={{ marginBottom: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Asset Type</th>
                        <th style={{ textAlign: 'right' }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryAssets.map((asset, idx) => (
                        <tr key={idx}>
                          <td><strong>{asset.name}</strong></td>
                          <td className="mono text-green" style={{ textAlign: 'right' }}>
                            {formatCurrency(asset.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Liabilities Column */}
                <div className="table-wrapper" style={{ marginBottom: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Credit Card / Liability</th>
                        <th style={{ textAlign: 'right' }}>Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryLiabilities.map((liability, idx) => (
                        <tr key={idx}>
                          <td><strong>{liability.name}</strong></td>
                          <td className="mono text-red" style={{ textAlign: 'right' }}>
                            {formatCurrency(liability.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* HOLDINGS DETAIL */}
            <section>
              <h2>Holdings Overview (Real P&L)</h2>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Qty</th>
                      <th>Avg Price</th>
                      <th>LTP</th>
                      <th>Invested</th>
                      <th>Current Val</th>
                      <th>P&L</th>
                      <th>% Ret</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHoldings.map((holding, idx) => (
                      <tr key={idx}>
                        <td className="mono"><strong>{holding.symbol}</strong></td>
                        <td className="mono">{holding.quantity}</td>
                        <td className="mono">₹{holding.avgPrice.toFixed(2)}</td>
                        <td className="mono">₹{holding.currentPrice.toFixed(2)}</td>
                        <td className="mono">{formatCurrency(holding.invested)}</td>
                        <td className="mono">{formatCurrency(holding.current)}</td>
                        <td className={`mono ${holding.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                          {holding.pnl >= 0 ? '+' : ''}{formatCurrency(holding.pnl)}
                        </td>
                        <td className={`mono ${holding.pnlPercent >= 0 ? 'text-green' : 'text-red'}`}>
                          {holding.pnlPercent >= 0 ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}