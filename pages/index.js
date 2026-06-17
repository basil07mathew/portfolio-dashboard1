import React, { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [holdings, setHoldings] = useState([]);
  const [summary, setSummary] = useState({});
  const [loans, setLoans] = useState({ given: [], pf: {} });
  const [stats, setStats] = useState({ 
    totalInvested: 0, 
    currentValue: 0, 
    unrealisedPnL: 0,
    totalAssets: 0,
    netWorth: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('holdings');

  // ⚠️ REPLACE THESE WITH YOUR VALUES
  const SHEET_ID = '1F6xHrJnrChEmvop-YOIycodgd133IjBAtliDljFM2EA';
  const API_KEY = 'AIzaSyAqdKsVXtt1bhpptkV6Hm5tl1rvblivKHU';

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch Holdings sheet
      const holdingsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Holdings?key=${API_KEY}`;
      const holdingsRes = await fetch(holdingsUrl);
      const holdingsData = await holdingsRes.json();

      // Fetch Summary sheet
      const summaryUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Summary?key=${API_KEY}`;
      const summaryRes = await fetch(summaryUrl);
      const summaryData = await summaryRes.json();

      // Fetch Loans sheet
      const loansUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Loans?key=${API_KEY}`;
      const loansRes = await fetch(loansUrl);
      const loansData = await loansRes.json();

      if (!holdingsRes.ok || !summaryRes.ok || !loansRes.ok) {
        throw new Error('Failed to fetch data from sheets');
      }

      // Parse Holdings
      const parsedHoldings = parseHoldings(holdingsData.values);
      setHoldings(parsedHoldings);

      // Parse Summary
      const parsedSummary = parseSummary(summaryData.values);
      setSummary(parsedSummary);

      // Parse Loans
      const parsedLoans = parseLoans(loansData.values);
      setLoans(parsedLoans);

      // Calculate stats
      const holdingsStats = calculateHoldingsStats(parsedHoldings);
      const assetStats = calculateAssetStats(parsedSummary, parsedLoans);
      
      setStats({
        totalInvested: holdingsStats.invested,
        currentValue: holdingsStats.current,
        unrealisedPnL: holdingsStats.pnl,
        totalAssets: assetStats.totalAssets,
        netWorth: assetStats.netWorth
      });

      setLastUpdated(new Date().toLocaleString('en-IN'));
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const parseHoldings = (values) => {
    if (!values || values.length < 2) return [];
    
    const headers = values[0];
    return values.slice(1)
      .filter(row => row[0])
      .map(row => {
        const quantity = parseInt(row[3]) || 0;
        const avgPrice = parseFloat(row[8]) || 0;
        const prevPrice = parseFloat(row[9]) || 0;
        const pnl = parseFloat(row[10]) || 0;
        const pnlPct = parseFloat(row[11]) || 0;

        const invested = quantity * avgPrice;
        const current = quantity * prevPrice;

        return {
          symbol: row[0]?.toString() || '',
          isin: row[1]?.toString() || '',
          sector: row[2]?.toString() || '',
          quantity,
          avgPrice,
          currentPrice: prevPrice,
          invested,
          current,
          pnl,
          pnlPercent: pnlPct.toFixed(2),
        };
      });
  };

  const parseSummary = (values) => {
    if (!values) return {};
    
    const summary = {
      assets: {},
      debt: {},
      savings: {}
    };

    // Parse Assets (rows 6-10 usually)
    const assetRows = values.slice(5, 11);
    assetRows.forEach(row => {
      if (row[2]) {
        summary.assets[row[2]] = {
          amount: parseFloat(row[3]) || 0,
          percentage: row[4] || '0%'
        };
      }
    });

    return summary;
  };

  const parseLoans = (values) => {
    if (!values) return { given: [], pf: {} };

    const result = {
      given: [],
      pf: {}
    };

    // Parse bank savings (B column, rows 2-7)
    values.slice(1, 8).forEach(row => {
      if (row[0] && row[1]) {
        result.given.push({
          person: row[0],
          amount: parseFloat(row[1]) || 0
        });
      }
    });

    // Parse PF (F column)
    if (values.length > 1) {
      result.pf.ttec = parseFloat(values[1][5]) || 0;
      result.pf.infy = 'withdrawn';
    }

    return result;
  };

  const calculateHoldingsStats = (holdings) => {
    const invested = holdings.reduce((sum, h) => sum + h.invested, 0);
    const current = holdings.reduce((sum, h) => sum + h.current, 0);
    const pnl = current - invested;

    return { invested, current, pnl };
  };

  const calculateAssetStats = (summary, loans) => {
    const assets = Object.values(summary.assets || {}).reduce((sum, a) => sum + a.amount, 0);
    const loansGiven = loans.given.reduce((sum, l) => sum + l.amount, 0);
    const pfTotal = Object.values(loans.pf || {}).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
    
    const totalAssets = assets + loansGiven + pfTotal;
    const debt = 60700; // From your excel - update as needed
    const netWorth = totalAssets - debt;

    return { totalAssets, netWorth };
  };

  const formatCurrency = (value) => {
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
    return `₹${value.toFixed(0)}`;
  };

  const sortedHoldings = [...holdings].sort((a, b) => b.current - a.current);

  return (
    <>
      <Head>
        <title>Basil's Complete Portfolio Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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

          .refresh-btn {
            background: var(--accent);
            color: var(--bg);
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
            transition: opacity 0.2s;
          }

          .refresh-btn:hover { opacity: 0.9; }

          .tabs {
            display: flex;
            gap: 8px;
            margin-bottom: 32px;
            border-bottom: 1px solid var(--border);
          }

          .tab-btn {
            padding: 12px 16px;
            background: transparent;
            border: none;
            border-bottom: 2px solid transparent;
            color: var(--muted);
            cursor: pointer;
            transition: all 0.2s;
            font-family: 'DM Sans', sans-serif;
            font-size: 13px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .tab-btn.active {
            color: var(--text);
            border-bottom-color: var(--accent);
          }

          .tab-btn:hover {
            color: var(--text);
          }

          .tab-content { display: none; }
          .tab-content.active { display: block; }

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
            top: 0;
            left: 0;
            right: 0;
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
          }

          .stat-value.green { color: var(--accent2); }
          .stat-value.red { color: var(--accent3); }
          .stat-value.gold { color: var(--accent); }

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

          tr:hover td { background: rgba(255, 255, 255, 0.02); }

          .mono { font-family: 'DM Mono', monospace; }
          .text-green { color: var(--accent2); }
          .text-red { color: var(--accent3); }
          .text-gold { color: var(--accent); }

          .loading {
            text-align: center;
            padding: 40px 20px;
            color: var(--muted);
          }

          .list-item {
            padding: 12px 0;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          footer {
            padding: 24px 0;
            text-align: center;
            color: var(--muted);
            font-size: 11px;
            margin-top: 40px;
          }

          @media (max-width: 768px) {
            .container { padding: 0 16px; }
            .stats-grid { grid-template-columns: 1fr; }
            .tabs { flex-wrap: wrap; }
            h1 { font-size: 28px; }
          }
        `}</style>
      </Head>

      <div className="container">
        <header>
          <h1>📊 Complete Portfolio Dashboard</h1>
          <div className="header-controls">
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Last Updated: {lastUpdated || 'Never'} | Data pulls from 3 sheets: Holdings, Summary, Loans
            </div>
            <button 
              className="refresh-btn" 
              onClick={fetchData}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
        </header>

        {error && (
          <div className="error-box">
            ⚠️ <strong>Error:</strong> {error}
          </div>
        )}

        {loading && holdings.length === 0 ? (
          <div className="loading">Loading your portfolio data...</div>
        ) : (
          <>
            {/* Tabs */}
            <div className="tabs">
              <button 
                className={`tab-btn ${activeTab === 'holdings' ? 'active' : ''}`}
                onClick={() => setActiveTab('holdings')}
              >
                📈 Holdings
              </button>
              <button 
                className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                🏦 Asset Allocation
              </button>
              <button 
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                👁️ Overview
              </button>
            </div>

            {/* Overview Tab */}
            <div className={`tab-content ${activeTab === 'overview' ? 'active' : ''}`}>
              <div className="stats-grid">
                <div className="stat-card gold">
                  <div className="stat-label">Total Assets</div>
                  <div className="stat-value gold">{formatCurrency(stats.totalAssets)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>All holdings + loans + savings</div>
                </div>

                <div className="stat-card red">
                  <div className="stat-label">Total Debt</div>
                  <div className="stat-value red">₹60,700</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>Credit card dues</div>
                </div>

                <div className={`stat-card ${stats.netWorth >= 0 ? 'green' : 'red'}`}>
                  <div className="stat-label">Net Worth</div>
                  <div className={`stat-value ${stats.netWorth >= 0 ? 'green' : 'red'}`}>{formatCurrency(stats.netWorth)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>Assets - Debt</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Equity Holdings</div>
                  <div className="stat-value">{holdings.length}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>Active stocks</div>
                </div>
              </div>

              {/* Loans Section */}
              {loans.given.length > 0 && (
                <div className="table-wrapper">
                  <h3 style={{ padding: '20px 16px 0', fontSize: '16px' }}>💸 Loans Given to Friends</h3>
                  <table style={{ marginTop: '12px' }}>
                    <thead>
                      <tr>
                        <th>Person</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loans.given.map((loan, idx) => (
                        <tr key={idx}>
                          <td>{loan.person}</td>
                          <td className="mono">{formatCurrency(loan.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Holdings Tab */}
            <div className={`tab-content ${activeTab === 'holdings' ? 'active' : ''}`}>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Invested</div>
                  <div className="stat-value gold">{formatCurrency(stats.totalInvested)}</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">Current Value</div>
                  <div className="stat-value">{formatCurrency(stats.currentValue)}</div>
                </div>

                <div className={`stat-card ${stats.unrealisedPnL >= 0 ? 'green' : 'red'}`}>
                  <div className="stat-label">Unrealised P&L</div>
                  <div className={`stat-value ${stats.unrealisedPnL >= 0 ? 'green' : 'red'}`}>
                    {stats.unrealisedPnL >= 0 ? '+' : ''}{formatCurrency(stats.unrealisedPnL)}
                  </div>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Sector</th>
                      <th>Qty</th>
                      <th>Avg Price</th>
                      <th>Current</th>
                      <th>P&L</th>
                      <th>% Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHoldings.map((h, idx) => (
                      <tr key={idx}>
                        <td className="mono"><strong>{h.symbol}</strong></td>
                        <td>{h.sector}</td>
                        <td className="mono">{h.quantity}</td>
                        <td className="mono">₹{h.avgPrice.toFixed(2)}</td>
                        <td className="mono">₹{h.currentPrice.toFixed(2)}</td>
                        <td className={`mono ${h.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                          {h.pnl >= 0 ? '+' : ''}{formatCurrency(h.pnl)}
                        </td>
                        <td className={`mono ${h.pnlPercent >= 0 ? 'text-green' : 'text-red'}`}>
                          {h.pnlPercent >= 0 ? '+' : ''}{h.pnlPercent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Tab */}
            <div className={`tab-content ${activeTab === 'summary' ? 'active' : ''}`}>
              <div className="table-wrapper">
                <h3 style={{ padding: '20px 16px 0', fontSize: '16px' }}>Asset Allocation Breakdown</h3>
                <table style={{ marginTop: '12px' }}>
                  <thead>
                    <tr>
                      <th>Asset Class</th>
                      <th>Amount</th>
                      <th>Allocation %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(summary.assets || {}).map(([name, data], idx) => (
                      <tr key={idx}>
                        <td>{name}</td>
                        <td className="mono">{formatCurrency(data.amount)}</td>
                        <td className="mono">{data.percentage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <footer>
          <p>📊 Complete Dashboard v2.0 · Reads from 3 sheets: Holdings, Summary, Loans</p>
          <p style={{ marginTop: '8px', fontSize: '10px' }}>Auto-updates every 5 minutes · Last refresh: {lastUpdated || 'Never'}</p>
        </footer>
      </div>
    </>
  );
}