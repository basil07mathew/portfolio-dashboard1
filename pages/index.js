import React, { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [holdings, setHoldings] = useState([]);
  const [stats, setStats] = useState({ totalInvested: 0, currentValue: 0, unrealisedPnL: 0 });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  // ⚠️ REPLACE THESE WITH YOUR VALUES
  const SHEET_ID = '1F6xHrJnrChEmvop-YOIycodgd133IjBAtliDljFM2EA'; // From Google Sheets URL
  const SHEET_NAME = 'Holdings'; // Sheet name in Google Sheets
  const API_KEY = 'AIzaSyAqdKsVXtt1bhpptkV6Hm5tl1rvblivKHU'; // From Google Cloud Console

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // Auto-refresh every 5 mins
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Construct Google Sheets API URL
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.values || data.values.length < 2) {
        throw new Error('No data found in sheet');
      }

      const headers = data.values[0];
      const rows = data.values.slice(1);

      // Parse holdings from sheet
      const parsedHoldings = rows
        .filter(row => row[0]) // Skip empty rows
        .map(row => {
          const quantity = parseInt(row[3]) || 0;
          const avgPrice = parseFloat(row[4]) || 0;
          const currentPrice = parseFloat(row[5]) || 0;

          const invested = quantity * avgPrice;
          const current = quantity * currentPrice;
          const pnl = current - invested;
          const pnlPercent = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : 0;

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
            notes: row[6]?.toString() || '',
          };
        });

      // Calculate stats
      const totalInvested = parsedHoldings.reduce((sum, h) => sum + h.invested, 0);
      const currentValue = parsedHoldings.reduce((sum, h) => sum + h.current, 0);
      const unrealisedPnL = currentValue - totalInvested;

      setHoldings(parsedHoldings);
      setStats({ totalInvested, currentValue, unrealisedPnL });
      setLastUpdated(new Date().toLocaleString('en-IN'));
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const gainPercent = stats.totalInvested > 0 
    ? ((stats.unrealisedPnL / stats.totalInvested) * 100).toFixed(2)
    : 0;

  const formatCurrency = (value) => {
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
    return `₹${value.toFixed(0)}`;
  };

  const sortedHoldings = [...holdings].sort((a, b) => b.current - a.current);

  return (
    <>
      <Head>
        <title>Basil's Portfolio Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Professional Portfolio Tracking Dashboard" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
        <style>{`
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
            --accent4: #60a5fa;
          }

          * { margin: 0; padding: 0; box-sizing: border-box; }
          html { scroll-behavior: smooth; }
          body { 
            background: var(--bg);
            color: var(--text);
            font-family: 'DM Sans', sans-serif;
            font-size: 14px;
            line-height: 1.6;
          }

          .container { max-width: 1400px; margin: 0 auto; padding: 0 24px; }

          header {
            padding: 40px 0 30px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 40px;
          }

          h1 {
            font-family: 'Playfair Display', serif;
            font-size: clamp(28px, 5vw, 48px);
            font-weight: 900;
            margin-bottom: 16px;
            color: var(--text);
          }

          .header-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 20px;
          }

          .header-info {
            display: flex;
            gap: 24px;
            flex-wrap: wrap;
            font-size: 12px;
            color: var(--muted);
          }

          .refresh-btn {
            background: var(--accent);
            color: var(--bg);
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
            font-family: 'DM Sans', sans-serif;
            transition: opacity 0.2s;
          }

          .refresh-btn:hover { opacity: 0.9; }
          .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

          .error-box {
            background: rgba(248, 113, 113, 0.1);
            border: 1px solid rgba(248, 113, 113, 0.3);
            color: #fca5a5;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 24px;
            font-size: 13px;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
          }

          .stat-card {
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            position: relative;
            overflow: hidden;
            transition: border-color 0.2s;
          }

          .stat-card:hover { border-color: rgba(240, 180, 41, 0.3); }

          .stat-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
            background: var(--accent);
            transform: scaleX(0);
            transition: transform 0.2s;
          }

          .stat-card:hover::before { transform: scaleX(1); }
          .stat-card.green::before { background: var(--accent2); }
          .stat-card.red::before { background: var(--accent3); }

          .stat-label {
            font-size: 11px;
            color: var(--muted);
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 8px;
          }

          .stat-value {
            font-family: 'DM Mono', monospace;
            font-size: 22px;
            font-weight: 600;
            color: var(--text);
            word-break: break-word;
          }

          .stat-value.green { color: var(--accent2); }
          .stat-value.red { color: var(--accent3); }
          .stat-value.gold { color: var(--accent); }

          .stat-sub {
            font-size: 11px;
            color: var(--muted);
            margin-top: 8px;
          }

          .loading {
            text-align: center;
            padding: 40px 20px;
            color: var(--muted);
            font-size: 14px;
          }

          .table-wrapper {
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow-x: auto;
            margin-bottom: 32px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }

          th {
            background: var(--bg2);
            padding: 14px 16px;
            text-align: left;
            font-size: 11px;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1px solid var(--border);
            font-weight: 500;
          }

          td {
            padding: 12px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          }

          tr:last-child td { border-bottom: none; }
          tr:hover td { background: rgba(255, 255, 255, 0.02); }

          .mono { font-family: 'DM Mono', monospace; }
          .text-green { color: var(--accent2); }
          .text-red { color: var(--accent3); }
          .text-gold { color: var(--accent); }

          section { padding: 32px 0; border-bottom: 1px solid var(--border); }
          section:last-child { border-bottom: none; }

          section h2 {
            font-family: 'Playfair Display', serif;
            font-size: 24px;
            margin-bottom: 6px;
            color: var(--text);
          }

          .section-sub {
            color: var(--muted);
            font-size: 13px;
            margin-bottom: 24px;
          }

          footer {
            padding: 24px 0;
            text-align: center;
            color: var(--muted);
            font-size: 11px;
          }

          @media (max-width: 768px) {
            .container { padding: 0 16px; }
            .stats-grid { grid-template-columns: 1fr; }
            table { font-size: 12px; }
            th, td { padding: 10px 12px; }
            h1 { font-size: 28px; }
          }
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
            <button 
              className="refresh-btn" 
              onClick={fetchData}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : '🔄 Refresh Now'}
            </button>
          </div>
        </header>

        {error && (
          <div className="error-box">
            ⚠️ <strong>Error:</strong> {error}
            <br />
            <small style={{ marginTop: '8px', display: 'block' }}>
              Check: Sheet ID, API Key, Sheet name, and that sheet is public
            </small>
          </div>
        )}

        {loading && holdings.length === 0 ? (
          <div className="loading">
            Loading your portfolio data...
          </div>
        ) : (
          <>
            <section>
              <h2>Portfolio Overview</h2>
              <p className="section-sub">Your complete holdings summary and performance metrics</p>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Invested</div>
                  <div className="stat-value gold">{formatCurrency(stats.totalInvested)}</div>
                  <div className="stat-sub">{holdings.length} holdings</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Current Value</div>
                  <div className="stat-value">{formatCurrency(stats.currentValue)}</div>
                  <div className="stat-sub">Market value</div>
                </div>

                <div className={`stat-card ${stats.unrealisedPnL >= 0 ? 'green' : 'red'}`}>
                  <div className="stat-label">Unrealised P&L</div>
                  <div className={`stat-value ${stats.unrealisedPnL >= 0 ? 'green' : 'red'}`}>
                    {stats.unrealisedPnL >= 0 ? '+' : ''}{formatCurrency(stats.unrealisedPnL)}
                  </div>
                  <div className="stat-sub">{gainPercent}% gain</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Portfolio Size</div>
                  <div className="stat-value">{holdings.length} Stocks</div>
                  <div className="stat-sub">Active positions</div>
                </div>
              </div>
            </section>

            <section>
              <h2>Holdings Details</h2>
              <p className="section-sub">Complete breakdown of all your positions</p>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Sector</th>
                      <th>Quantity</th>
                      <th>Avg Price</th>
                      <th>Current</th>
                      <th>Invested</th>
                      <th>Current Value</th>
                      <th>P&L</th>
                      <th>% Return</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHoldings.map((holding, idx) => (
                      <tr key={idx}>
                        <td className="mono"><strong>{holding.symbol}</strong></td>
                        <td>{holding.sector}</td>
                        <td className="mono">{holding.quantity}</td>
                        <td className="mono">₹{holding.avgPrice.toFixed(2)}</td>
                        <td className="mono">₹{holding.currentPrice.toFixed(2)}</td>
                        <td className="mono">{formatCurrency(holding.invested)}</td>
                        <td className="mono">{formatCurrency(holding.current)}</td>
                        <td className={`mono ${holding.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                          {holding.pnl >= 0 ? '+' : ''}{formatCurrency(holding.pnl)}
                        </td>
                        <td className={`mono ${holding.pnlPercent >= 0 ? 'text-green' : 'text-red'}`}>
                          {holding.pnlPercent >= 0 ? '+' : ''}{holding.pnlPercent}%
                        </td>
                        <td>{holding.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2>Top Performers</h2>
              <p className="section-sub">Best and worst performing holdings</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div>
                  <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>🚀 Top 5 Gainers</h3>
                  {sortedHoldings
                    .sort((a, b) => b.pnlPercent - a.pnlPercent)
                    .slice(0, 5)
                    .map((h, i) => (
                      <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong>{h.symbol}</strong>
                          <span className="text-green mono">+{h.pnlPercent}%</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {formatCurrency(h.current)} · {formatCurrency(h.pnl)}
                        </div>
                      </div>
                    ))}
                </div>

                <div>
                  <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>📉 Top 5 Losers</h3>
                  {sortedHoldings
                    .sort((a, b) => a.pnlPercent - b.pnlPercent)
                    .slice(0, 5)
                    .map((h, i) => (
                      <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <strong>{h.symbol}</strong>
                          <span className="text-red mono">{h.pnlPercent}%</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {formatCurrency(h.current)} · {formatCurrency(h.pnl)}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </section>
          </>
        )}

        <footer>
          <p>📊 Portfolio Dashboard v1.0 · Auto-updates every 5 minutes</p>
          <p style={{ marginTop: '8px', fontSize: '10px' }}>Data from Google Sheets · Last refresh: {lastUpdated || 'Never'}</p>
        </footer>
      </div>
    </>
  );
}