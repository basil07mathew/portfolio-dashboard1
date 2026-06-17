import React, { useState, useEffect } from 'react';
import Head from 'next/head';

const SHEET_ID = '1F6xHrJnrChEmvop-YOIycodgd133IjBAtliDljFM2EA';
const API_KEY = 'AIzaSyAqdKsVXtt1bhpptkV6Hm5tl1rvblivKHU';

export default function PortfolioDashboard() {
  const [holdings, setHoldings] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const parseNumber = (value) => {
    if (!value) return 0;
    return Number(
      value
        .toString()
        .replace(/[₹,%]/g, '')
        .replace(/,/g, '')
        .trim()
    ) || 0;
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 300000);

    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      
      const holdingsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Holdings!A:Z?key=${API_KEY}`;
      const loansUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Loans!A:Z?key=${API_KEY}`;

      const [holdingsRes, loansRes] = await Promise.all([
        fetch(holdingsUrl),
        fetch(loansUrl)
      ]);

      if (!holdingsRes.ok) {
        throw new Error(`Holdings ${holdingsRes.status}: ${await holdingsRes.text()}`);
      }

      if (!loansRes.ok) {
        throw new Error(`Loans ${loansRes.status}: ${await loansRes.text()}`);
      }

      const holdingsData = await holdingsRes.json();
      const loansData = await loansRes.json();

      const holdingRows = holdingsData.values?.slice(1) || [];

      const parsedHoldings = holdingRows
        .filter(row => row[0])
        .map(row => {
          const quantity = parseNumber(row[3]);
          const avgPrice = parseNumber(row[8]);
          const pnl = parseNumber(row[10]);
          const pnlPercent = parseNumber(row[11]);
          const invested = quantity * avgPrice;
          const current = invested + pnl;

          return {
            symbol: row[0] || '',
            sector: row[2] || '',
            quantity,
            avgPrice,
            invested,
            current,
            pnl,
            pnlPercent
          };
        });

      const loanRows = loansData.values?.slice(1) || [];

      const parsedLoans = loanRows
        .filter(row => row[0])
        .map(row => ({
          name: row[0] || '',
          amount: parseNumber(row[1])
        }));

      setHoldings(parsedHoldings);
      setLoans(parsedLoans);
      setLastUpdated(new Date().toLocaleString('en-IN'));
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalInvested = holdings.reduce((sum, h) => sum + h.invested, 0);
  const currentValue = holdings.reduce((sum, h) => sum + h.current, 0);
  const totalPnL = holdings.reduce((sum, h) => sum + h.pnl, 0);
  const totalLoan = loans.reduce((sum, l) => sum + l.amount, 0);
  const gainPercent = totalInvested ? ((totalPnL / totalInvested) * 100).toFixed(2) : 0;

  const formatCurrency = (num) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);

  return (
    <>
      <Head>
        <title>Basil Portfolio Dashboard</title>
      </Head>
      
      <div
        style={{
          background: '#0a0a0f',
          minHeight: '100vh',
          color: '#fff',
          padding: '30px',
          fontFamily: 'Arial'
        }}
      >
        <h1>Basil Mathew Portfolio</h1>

        <p>Last Updated: {lastUpdated}</p>

        {loading && <p>Loading...</p>}

        {error && (
          <div
            style={{
              background: '#400',
              padding: '15px',
              marginTop: '20px',
              borderRadius: '8px'
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
                gap: '20px',
                marginTop: '30px'
              }}
            >
              <Card title="Invested" value={formatCurrency(totalInvested)} />
              <Card title="Current Value" value={formatCurrency(currentValue)} />
              <Card title="P&L" value={`${formatCurrency(totalPnL)} (${gainPercent}%)`} />
              <Card title="Loans Given" value={formatCurrency(totalLoan)} />
            </div>

            <h2 style={{ marginTop: '50px' }}>Holdings</h2>

            <table style={{ width: '100%', marginTop: '20px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Symbol</th>
                  <th style={{ textAlign: 'left' }}>Sector</th>
                  <th style={{ textAlign: 'left' }}>Invested</th>
                  <th style={{ textAlign: 'left' }}>Current</th>
                  <th style={{ textAlign: 'left' }}>P&L</th>
                  <th style={{ textAlign: 'left' }}>Return %</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h, idx) => (
                  <tr key={idx}>
                    <td>{h.symbol}</td>
                    <td>{h.sector}</td>
                    <td>{formatCurrency(h.invested)}</td>
                    <td>{formatCurrency(h.current)}</td>
                    <td>{formatCurrency(h.pnl)}</td>
                    <td>{h.pnlPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 style={{ marginTop: '50px' }}>Loans Given</h2>

            <table style={{ width: '100%', marginTop: '20px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Name</th>
                  <th style={{ textAlign: 'left' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan, idx) => (
                  <tr key={idx}>
                    <td>{loan.name}</td>
                    <td>{formatCurrency(loan.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}

function Card({ title, value }) {
  return (
    <div
      style={{
        background: '#18181f',
        padding: '20px',
        borderRadius: '12px'
      }}
    >
      <div
        style={{
          color: '#999',
          marginBottom: '10px'
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: '24px',
          fontWeight: 'bold'
        }}
      >
        {value}
      </div>
    </div>
  );
}