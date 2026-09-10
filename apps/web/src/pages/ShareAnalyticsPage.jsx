import { useEffect, useState } from "react";
import { getShareAnalytics } from "../lib/apiClient";

// Simple internal dashboard for the viral share funnel: shares vs. landings
// per platform. Landings are attributed via UTM parameters on shared links.
export default function ShareAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getShareAnalytics()
      .then(setAnalytics)
      .catch((err) => setError(err?.message || "Failed to load share analytics"));
  }, []);

  const totals = analytics?.totals || { shares: 0, landings: 0 };
  const viralCoefficient =
    totals.shares > 0 ? (totals.landings / totals.shares).toFixed(2) : "0.00";

  return (
    <>
      <section className="page-header">
        <h1>Share Virality</h1>
        <p>How shared results turn into new visitors. A landing is a new user arriving via a shared link.</p>
      </section>

      <section className="info-section">
        {error && <p className="quiz-error">{error}</p>}

        {analytics && !analytics.enabled && (
          <div className="info-card">
            <h2>Persistence disabled</h2>
            <p>Connect MongoDB to start collecting share and landing events.</p>
          </div>
        )}

        {analytics?.enabled && (
          <>
            <div className="info-card">
              <h2>Funnel Overview</h2>
              <p>Total shares: <strong>{totals.shares}</strong></p>
              <p>New visitors from shares: <strong>{totals.landings}</strong></p>
              <p>
                Viral coefficient (visitors per share): <strong>{viralCoefficient}</strong>
              </p>
            </div>

            <div className="info-card">
              <h2>By Platform</h2>
              {analytics.platforms.length === 0 ? (
                <p>No shares recorded yet.</p>
              ) : (
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Shares</th>
                      <th>Landings</th>
                      <th>Landing rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.platforms.map((row) => (
                      <tr key={row.platform}>
                        <td>{row.platform}</td>
                        <td>{row.shares}</td>
                        <td>{row.landings}</td>
                        <td>{Math.round(row.landingRate * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
