import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './Newsletter.css';

/* ────────────────────────────────────────────────────── */
/*  Helpers                                               */
/* ────────────────────────────────────────────────────── */

function safe(value, fallback = '\u2014') {
  if (value === null || value === undefined || value === '') return fallback;
  return value;
}

function badgeClass(decision) {
  const d = (decision || '').toUpperCase();
  if (d === 'BUY') return 'nl-badge-buy';
  if (d === 'SELL') return 'nl-badge-sell';
  return 'nl-badge-hold';
}

function confidenceColor(value) {
  if (value >= 70) return '#3fb950';
  if (value >= 40) return '#d29922';
  return '#f85149';
}

/** Extract h2 headings from markdown for the Table of Contents. */
function extractHeadings(markdown) {
  if (!markdown) return [];
  const headings = [];
  const regex = /^## +(.+)$/gm;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const text = match[1].replace(/[*_`~]/g, '').trim();
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    headings.push({ text, id });
  }
  return headings;
}

/** Generate a slug id from heading text (must match extractHeadings). */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

/* ────────────────────────────────────────────────────── */
/*  Scroll Progress Bar                                   */
/* ────────────────────────────────────────────────────── */

function ScrollProgress({ containerRef }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      if (scrollHeight > 0) {
        setProgress(Math.min((scrollTop / scrollHeight) * 100, 100));
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [containerRef]);

  return (
    <div className="nl-scroll-progress-track">
      <div
        className="nl-scroll-progress-bar"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Table of Contents — shared scroll-tracking hook       */
/* ────────────────────────────────────────────────────── */

function useActiveTocId(headings, scrollContainerRef) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || headings.length === 0) return;

    const onScroll = () => {
      let current = '';
      for (const h of headings) {
        const el = container.querySelector(`[id="${h.id}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          if (rect.top - containerRect.top <= 120) {
            current = h.id;
          }
        }
      }
      setActiveId(current);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener('scroll', onScroll);
  }, [headings, scrollContainerRef]);

  return activeId;
}

function useScrollToHeading(scrollContainerRef) {
  return useCallback(
    (id) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const target = container.querySelector(`[id="${id}"]`);
      if (target) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        container.scrollTo({
          top: container.scrollTop + (targetRect.top - containerRect.top) - 24,
          behavior: 'smooth',
        });
      }
    },
    [scrollContainerRef],
  );
}

function TocList({ headings, activeId, onSelect }) {
  return (
    <ul className="nl-toc-list">
      {headings.map((h) => (
        <li key={h.id} className={activeId === h.id ? 'nl-toc-active' : ''}>
          <button onClick={() => onSelect(h.id)}>{h.text}</button>
        </li>
      ))}
    </ul>
  );
}

/* Desktop sidebar — hidden on narrow viewports via CSS */
function TocSidebar({ headings, scrollContainerRef }) {
  const activeId = useActiveTocId(headings, scrollContainerRef);
  const scrollTo = useScrollToHeading(scrollContainerRef);
  if (headings.length === 0) return null;

  return (
    <aside className="nl-toc-sidebar">
      <TocList headings={headings} activeId={activeId} onSelect={scrollTo} />
    </aside>
  );
}

/* Mobile dropdown — hidden on wide viewports via CSS */
function TocMobile({ headings, scrollContainerRef }) {
  const [open, setOpen] = useState(false);
  const activeId = useActiveTocId(headings, scrollContainerRef);
  const scrollToRaw = useScrollToHeading(scrollContainerRef);
  const scrollTo = useCallback(
    (id) => { scrollToRaw(id); setOpen(false); },
    [scrollToRaw],
  );
  if (headings.length === 0) return null;

  return (
    <div className="nl-toc-mobile">
      <button
        className="nl-toc-mobile-toggle"
        onClick={() => setOpen((o) => !o)}
      >
        <span>Table of Contents</span>
        <span className={`nl-toc-chevron ${open ? 'nl-toc-chevron--open' : ''}`}>
          &#9662;
        </span>
      </button>
      {open && (
        <div className="nl-toc-mobile-panel">
          <TocList headings={headings} activeId={activeId} onSelect={scrollTo} />
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Newsletter Header (ticker, date, decision, conf)     */
/* ────────────────────────────────────────────────────── */

function NewsletterHeader({ metadata, edition }) {
  const ticker = safe(metadata?.ticker);
  const date = safe(metadata?.trade_date);
  const decision = safe(metadata?.decision);
  const confidence = metadata?.confidence ?? null;

  return (
    <div className="nl-header">
      <div className="nl-header-left">
        <span className="nl-header-ticker">{ticker}</span>
        <span className="nl-header-date">{date}</span>
        <span className={`nl-header-edition ${edition === 'premium' ? 'nl-header-edition--premium' : ''}`}>
          {edition === 'premium' ? '\u2605 Premium' : '\uD83D\uDD12 Free'}
        </span>
      </div>
      <div className="nl-header-right">
        <span className={`nl-decision-badge ${badgeClass(decision)}`}>
          {decision}
        </span>
        {confidence != null && (
          <div className="nl-confidence">
            <span className="nl-confidence-label">Confidence</span>
            <div className="nl-confidence-track">
              <div
                className="nl-confidence-fill"
                style={{
                  width: `${confidence}%`,
                  background: confidenceColor(confidence),
                }}
              />
            </div>
            <span
              className="nl-confidence-value"
              style={{ color: confidenceColor(confidence) }}
            >
              {confidence}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Action buttons (Copy + Print)                         */
/* ────────────────────────────────────────────────────── */

function ActionButtons({ markdown }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback */
      const ta = document.createElement('textarea');
      ta.value = markdown;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [markdown]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="nl-actions">
      <button className="nl-action-btn" onClick={handleCopy} title="Copy markdown to clipboard">
        {copied ? '\u2705 Copied' : '\uD83D\uDCCB Copy'}
      </button>
      <button className="nl-action-btn" onClick={handlePrint} title="Print newsletter">
        \uD83D\uDDA8 Print
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Main Newsletter component                             */
/* ────────────────────────────────────────────────────── */

function Newsletter({ data }) {
  const [activeTab, setActiveTab] = useState('free');
  const bodyRef = useRef(null);

  const freeMarkdown = data?.newsletters?.free_markdown || '';
  const premiumMarkdown = data?.newsletters?.premium_markdown || '';
  const activeMarkdown = activeTab === 'free' ? freeMarkdown : premiumMarkdown;
  const hasContent = activeMarkdown && activeMarkdown.trim().length > 0;

  const headings = useMemo(
    () => (activeTab === 'premium' ? extractHeadings(activeMarkdown) : []),
    [activeTab, activeMarkdown],
  );

  const isPremium = activeTab === 'premium';

  /* Custom renderers to inject id attributes on h2 for ToC scrolling */
  const markdownComponents = useMemo(
    () => ({
      h2({ children }) {
        const text =
          typeof children === 'string'
            ? children
            : Array.isArray(children)
              ? children
                  .map((c) => (typeof c === 'string' ? c : c?.props?.children ?? ''))
                  .join('')
              : '';
        const id = slugify(String(text));
        return <h2 id={id}>{children}</h2>;
      },
    }),
    [],
  );

  return (
    <div className="nl-wrapper">
      <div className={`nl-container ${isPremium && headings.length > 0 ? 'nl-container--with-toc' : ''}`}>
        {/* Main column */}
        <div className="nl-main">
          {/* Tabs */}
          <div className="nl-tabs">
            <button
              className={`nl-tab nl-tab--free ${activeTab === 'free' ? 'nl-tab--active' : ''}`}
              onClick={() => setActiveTab('free')}
            >
              {'\uD83D\uDD12'} Free Edition
            </button>
            <button
              className={`nl-tab nl-tab--premium ${activeTab === 'premium' ? 'nl-tab--active' : ''}`}
              onClick={() => setActiveTab('premium')}
            >
              {'\u2605'} Premium Edition
            </button>
          </div>

          {/* Newsletter header info */}
          <NewsletterHeader metadata={data?.metadata} edition={activeTab} />

          {/* Action buttons */}
          {hasContent && <ActionButtons markdown={activeMarkdown} />}

          {/* Scroll progress bar */}
          <ScrollProgress containerRef={bodyRef} />

          {/* Mobile ToC (premium only, hidden on desktop via CSS) */}
          {isPremium && headings.length > 0 && (
            <TocMobile headings={headings} scrollContainerRef={bodyRef} />
          )}

          {/* Body */}
          <div className="nl-body" ref={bodyRef}>
            {hasContent ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {activeMarkdown}
              </ReactMarkdown>
            ) : (
              <div className="nl-empty">
                <p>No newsletter content available for this edition.</p>
              </div>
            )}
          </div>
        </div>

        {/* Desktop ToC sidebar (premium only, hidden on mobile via CSS) */}
        {isPremium && headings.length > 0 && (
          <TocSidebar headings={headings} scrollContainerRef={bodyRef} />
        )}
      </div>
    </div>
  );
}

export default Newsletter;
