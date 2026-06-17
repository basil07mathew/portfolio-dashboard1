import React, { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [holdings, setHoldings] = useState([]);
  const [loans, setLoans] = useState([]);
  const [stats, setStats] = useState({ 
    totalInvested: 0, currentValue: 0, unrealisedPnL: 0, totalHoldings: 0, totalLoan: 0 
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const SHEET_ID = process.env.NEXT_PUBLIC_SHEET_ID;
  const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); 
    return () => clearInterval(interval);
  }, []);

  // Helper to safely parse numbers formatted with commas or currency symbols
  const parseSheetNumber = (val) => {
    if (!val) return 0;
    const cleanStr = val.toString().replace(/[₹,%]/g, '').trim();
    return parseFloat(cleanStr) || 0;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all three sheets concurrently
      const [holdingsRes, summaryRes, loansRes] = await Promise.all([
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Holdings?key=${API_KEY}`),
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Summary?key=${API_KEY}`),
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Loans?key=${API_KEY}`)
      ]);
      
      if (!holdingsRes.ok || !summaryRes.ok || !loansRes.ok) {
        throw new Error('API Error: Ensure Sheet ID, API Key, and Sheet names are correct and the sheet is public.');
      }

      const holdingsData = await holdingsRes.json();
      const summaryData = await summaryRes.json();
      const loansData = await loansRes.json();

      // 1. PARSE HOLDINGS (Based on exact Excel columns)
      if (holdingsData.values && holdingsData.values.length > 1) {
        const holdingsRows = holdingsData.values.slice(1);
        const parsedHoldings = holdingsRows
          .filter(row => row[0]) // Filter empty rows
          .map(row => ({
            symbol: row[0]?.toString() || '',          // Col A
            sector: row[1]?.toString() || '',          // Col B
            quantity: parseSheetNumber(row[3]),        // Col D
            avgPrice: parseSheetNumber(row[4]),        // Col E
            currentPrice: parseSheetNumber(row[5]),    // Col F
            invested: parseSheetNumber(row[6]),        // Col G
            current: parseSheetNumber(row[7]),         // Col H
            pnl: parseSheetNumber(row[8]),             // Col I
            pnlPercent: parseSheetNumber(row[9]),      // Col J
            notes: row[10]?.toString() || '',          // Col K
          }));

        setHoldings(parsedHoldings);
      }

      // 2. PARSE SUMMARY (Directly pulling stats from the Summary sheet)
      if (summaryData.values && summaryData.values.length > 1) {
        const summaryRows = summaryData.values.slice(1);
        const summaryObj = {};
        
        // Convert summary rows into a key-value object
        summaryRows.forEach(row => {
          if (row[0] && row[1]) {
            summaryObj[row[0].trim()] = parseSheetNumber(row[1]);
          }
        });

        setStats({
          totalInvested: summaryObj['Total Invested (₹)'] || 0,
          currentValue: summaryObj['Current Value (₹)'] || 0,
          unrealisedPnL: summaryObj['Unrealised P&L'] || 0,
          totalHoldings: summaryObj['Total Holdings'] || 0,
          totalLoan: summaryObj['Total Outstanding Loan'] || 0
        });
      }

      // 3. PARSE LOANS
      if (loansData.values && loansData.values.length > 1) {
        const loansRows = loansData.values.slice(1);
        const parsedLoans = loansRows
          .filter(row => row[0])
          .map(row => ({
            provider: row[0]?.toString() || '',      // Col A
            principal: parseSheetNumber(row[1]),     // Col B
            interestRate: parseSheetNumber(row[2]),  // Col C
            outstanding: parseSheetNumber(row[3]),   // Col D
            status: row[4]?.toString() || '',        // Col E
          }));
        
        setLoans(parsedLoans);
      }

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
          /* === KEEP YOUR EXACT EXISTING CSS STYLES HERE === */
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
          body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; line-height: 1.6; }
          .container { max-width: 1400px; margin: 0 auto; padding: 0 24px; }
          header { padding: 40px 0 30px; border-bottom: 1px solid var(--border); margin-bottom: 40px; }
          h1 { font-family: 'Playfair Display', serif; font-size: clamp(28px, 5vw, 48px); font-weight: 900; margin-bottom: 16px; }
          .header-controls { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
          .header-info { display: flex; gap: 24px; font-size: 12px; color: var(--muted); }
          .refresh-btn { background: var(--accent); color: var(--bg); border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
          .error-box { background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.3); color: #fca5a5; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
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
          .table-wrapper { background: var(--bg3); border: 1px solid var(--border); border-radius: 12px; overflow-x: auto; margin-bottom: 32px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: var(--bg2); padding: 14px 16px; text-align: left; font-size: 11px; color: var(--muted); text-transform: uppercase; border-bottom: 1px solid var(--border); }
          td { padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
          .mono { font-family: 'DM Mono', monospace; }
          .text-green { color: var(--accent2); }
          .text-red { color: var(--accent3); }
          section { padding: 32px 0; border-bottom: 1px solid var(--border); }
          section h2 { font-family: 'Playfair Display', serif; font-size: 24px; margin-bottom: 6px; }
          .section-sub { color: var(--muted); font-size: 13px; margin-bottom: 24px; }
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
            <section>
              <h2>Portfolio Overview</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Invested</div>
                  <div className="stat-value gold">{formatCurrency(stats.totalInvested)}</div>
                  <div className="stat-sub">{stats.totalHoldings} holdings</div>
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

                <div className="stat-card red">
                  <div className="stat-label">Outstanding Loans</div>
                  <div className="stat-value red">{formatCurrency(stats.totalLoan)}</div>
                  <div className="stat-sub">{loans.length} Active Loans</div>
                </div>
              </div>
            </section>

            <section>
              <h2>Holdings Details</h2>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Sector</th>
                      <th>Qty</th>
                      <th>Avg Price</th>
                      <th>LTP</th>
                      <th>Invested</th>
                      <th>Current Val</th>
                      <th>P&L</th>
                      <th>% Ret</th>
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
                          {holding.pnlPercent >= 0 ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
                        </td>
                        <td>{holding.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {loans.length > 0 && (
              <section>
                <h2>Active Loans</h2>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Loan Provider</th>
                        <th>Principal Amount</th>
                        <th>Interest Rate</th>
                        <th>Outstanding Balance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loans.map((loan, idx) => (
                        <tr key={idx}>
                          <td><strong>{loan.provider}</strong></td>
                          <td className="mono">{formatCurrency(loan.principal)}</td>
                          <td className="mono">{loan.interestRate}%</td>
                          <td className="mono text-red">{formatCurrency(loan.outstanding)}</td>
                          <td>{loan.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}