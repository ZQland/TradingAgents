import { useState, useEffect } from 'react';
import type { StructuredOutput } from './types';
import Dashboard from './components/Dashboard';
import Newsletter from './components/Newsletter';
import './App.css';

function App() {
  const [data, setData] = useState<StructuredOutput | null>(null);
  const [view, setView] = useState<'dashboard' | 'newsletter'>('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/structured_output.json')
      .then((res) => res.json())
      .then((json: StructuredOutput) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <p>Loading analysis data...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app-loading">
        <p>Failed to load data. Place structured_output.json in public/data/</p>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="app-nav">
        <div className="app-nav-brand">TradingAgents</div>
        <div className="app-nav-tabs">
          <button
            className={`app-nav-tab${view === 'dashboard' ? ' app-nav-tab--active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`app-nav-tab${view === 'newsletter' ? ' app-nav-tab--active' : ''}`}
            onClick={() => setView('newsletter')}
          >
            Newsletter
          </button>
        </div>
      </nav>

      {view === 'dashboard' ? (
        <Dashboard data={data} />
      ) : (
        <Newsletter data={data} />
      )}
    </div>
  );
}

export default App;
