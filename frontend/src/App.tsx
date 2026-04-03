import { useState, useEffect } from 'react';
import type { StructuredOutput } from './types';
import Dashboard from './components/Dashboard';
import Newsletter from './components/Newsletter';
import './App.css';

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

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

  // Keyboard shortcuts: 1 = Dashboard, 2 = Newsletter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') setView('dashboard');
      if (e.key === '2') setView('newsletter');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-brand">TradingAgents</div>
        <div className="app-loading-spinner" />
        <p>Loading analysis data...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app-loading">
        <div className="app-loading-brand">TradingAgents</div>
        <p>Failed to load data. Place structured_output.json in public/data/</p>
      </div>
    );
  }

  const generatedAt = formatTimestamp(data.generated_at);

  return (
    <div className="app">
      <nav className="app-nav">
        <div className="app-nav-brand">TradingAgents</div>

        <div className="app-nav-tabs">
          <button
            className={`app-nav-tab${view === 'dashboard' ? ' app-nav-tab--active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            Dashboard <span className="app-nav-shortcut">1</span>
          </button>
          <button
            className={`app-nav-tab${view === 'newsletter' ? ' app-nav-tab--active' : ''}`}
            onClick={() => setView('newsletter')}
          >
            Newsletter <span className="app-nav-shortcut">2</span>
          </button>
        </div>

        {generatedAt && (
          <div className="app-nav-meta">
            <span className="app-nav-freshness-dot" />
            <span className="app-nav-freshness">{generatedAt}</span>
          </div>
        )}
      </nav>

      {view === 'dashboard' ? (
        <Dashboard data={data} />
      ) : (
        <Newsletter data={data} />
      )}

      <footer className="app-footer">
        <span className="app-footer-text">
          Powered by TradingAgents Multi-Agent Analysis System
        </span>
        <span className="app-footer-version">v{data.version}</span>
      </footer>
    </div>
  );
}

export default App;
