import type { StructuredOutput } from '../types';
import './TrendVisualization.css';

/* ────────────────────────────────────────────────────── */
/*  Types                                                  */
/* ────────────────────────────────────────────────────── */

interface TrendVisualizationProps {
  data: StructuredOutput;
}

interface IndicatorData {
  name: string;
  value: number | null;
  direction: 'RISING' | 'FALLING' | null;
  velocity: 'ACCELERATING' | 'DECELERATING' | null;
  context: string | null;
}

interface ParsedTechnicals {
  sma50: IndicatorData | null;
  sma200: IndicatorData | null;
  macd: IndicatorData | null;
  macdSignal: IndicatorData | null;
  rsi: IndicatorData | null;
  bollMiddle: IndicatorData | null;
  bollUpper: IndicatorData | null;
  bollLower: IndicatorData | null;
  currentPrice: number | null;
}

/* ────────────────────────────────────────────────────── */
/*  Parser — extracts technicals from markdown             */
/* ────────────────────────────────────────────────────── */

function parseIndicator(markdown: string, indicatorKey: string): IndicatorData | null {
  // Match pattern: **indicator_key**: 123.45 | Direction: RISING | Velocity: ACCELERATING | Context: EXTREME HIGH
  const escapedKey = indicatorKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `\\*\\*${escapedKey}\\*\\*:\\s*(-?[\\d.]+)\\s*\\|\\s*Direction:\\s*(RISING|FALLING)\\s*\\|\\s*Velocity:\\s*(ACCELERATING|DECELERATING)\\s*\\|\\s*Context:\\s*([A-Z\\s]+)`,
    'i'
  );
  const match = markdown.match(pattern);
  if (!match) return null;

  return {
    name: indicatorKey,
    value: parseFloat(match[1]),
    direction: match[2].toUpperCase() as 'RISING' | 'FALLING',
    velocity: match[3].toUpperCase() as 'ACCELERATING' | 'DECELERATING',
    context: match[4].trim(),
  };
}

function parseCurrentPrice(markdown: string): number | null {
  // Match pattern: current price of XXX is 321.80
  const priceMatch = markdown.match(/current price[^]*?is\s+(\d+(?:\.\d+)?)/i);
  if (priceMatch) return parseFloat(priceMatch[1]);

  // Fallback: price of MU is 321.80
  const fallback = markdown.match(/price of \w+ is\s+(\d+(?:\.\d+)?)/i);
  if (fallback) return parseFloat(fallback[1]);

  return null;
}

function parseTechnicals(markdown: string): ParsedTechnicals {
  return {
    sma50: parseIndicator(markdown, 'close_50_sma'),
    sma200: parseIndicator(markdown, 'close_200_sma'),
    macd: parseIndicator(markdown, 'macd'),
    macdSignal: parseIndicator(markdown, 'macds'),
    rsi: parseIndicator(markdown, 'rsi'),
    bollMiddle: parseIndicator(markdown, 'boll'),
    bollUpper: parseIndicator(markdown, 'boll_ub'),
    bollLower: parseIndicator(markdown, 'boll_lb'),
    currentPrice: parseCurrentPrice(markdown),
  };
}

function parseDirectionalBias(markdown: string): { bias: string; confidence: string } | null {
  const biasMatch = markdown.match(/Directional bias\*\*:\s*\*\*(\w+)\*\*\s*\/\s*Confidence:\s*\*\*(\w+)\*\*/i);
  if (biasMatch) {
    return { bias: biasMatch[1], confidence: biasMatch[2] };
  }
  return null;
}

/* ────────────────────────────────────────────────────── */
/*  Utility helpers                                        */
/* ────────────────────────────────────────────────────── */

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function velocityLabel(ind: IndicatorData | null): string {
  if (!ind) return 'N/A';
  const dir = ind.direction === 'RISING' ? 'Rising' : 'Falling';
  const vel = ind.velocity === 'ACCELERATING' ? 'Accelerating' : 'Decelerating';
  return `${dir}, ${vel}`;
}

function signalColor(bullish: boolean | null): string {
  if (bullish === null) return '#8b949e';
  return bullish ? '#3fb950' : '#f85149';
}

/* ────────────────────────────────────────────────────── */
/*  Sub-components                                         */
/* ────────────────────────────────────────────────────── */

function MomentumGauge({ technicals }: { technicals: ParsedTechnicals }) {
  // Compute an overall momentum score from -100 (strong bearish) to +100 (strong bullish)
  // based on direction and velocity of key indicators
  let score = 0;
  let contributors = 0;

  function addSignal(ind: IndicatorData | null, bullishWhenRising: boolean) {
    if (!ind) return;
    contributors++;
    const dirScore = ind.direction === 'RISING' ? 1 : -1;
    const adjustedDir = bullishWhenRising ? dirScore : -dirScore;
    const velMultiplier = ind.velocity === 'ACCELERATING' ? 1.5 : 0.75;
    score += adjustedDir * velMultiplier * 20;
  }

  addSignal(technicals.sma50, true);
  addSignal(technicals.sma200, true);
  addSignal(technicals.macd, true);
  addSignal(technicals.rsi, true);
  addSignal(technicals.bollMiddle, true);

  if (contributors === 0) {
    return (
      <div className="tv-gauge-card">
        <div className="tv-gauge-title">Momentum</div>
        <div className="tv-na-text">N/A</div>
      </div>
    );
  }

  const normalizedScore = clamp(Math.round(score / contributors * (100 / 30)), -100, 100);
  const markerPosition = ((normalizedScore + 100) / 200) * 100;
  const isBullish = normalizedScore > 10;
  const isBearish = normalizedScore < -10;
  const label = isBullish ? 'Bullish' : isBearish ? 'Bearish' : 'Neutral';
  const labelColor = isBullish ? '#3fb950' : isBearish ? '#f85149' : '#d29922';

  return (
    <div className="tv-gauge-card">
      <div className="tv-gauge-title">Momentum</div>
      <div className="tv-momentum-bar-wrapper">
        <div className="tv-momentum-bar">
          <div className="tv-momentum-zone tv-momentum-bearish" />
          <div className="tv-momentum-zone tv-momentum-neutral" />
          <div className="tv-momentum-zone tv-momentum-bullish" />
          <div
            className="tv-momentum-marker"
            style={{ left: `${markerPosition}%` }}
          >
            <div className="tv-momentum-needle" style={{ background: labelColor }} />
            <div className="tv-momentum-value" style={{ color: labelColor }}>
              {normalizedScore > 0 ? '+' : ''}{normalizedScore}
            </div>
          </div>
        </div>
        <div className="tv-momentum-labels">
          <span>-100</span>
          <span>0</span>
          <span>+100</span>
        </div>
      </div>
      <div className="tv-gauge-signal" style={{ color: labelColor }}>{label}</div>
    </div>
  );
}

function RSIGauge({ rsi }: { rsi: IndicatorData | null }) {
  if (!rsi || rsi.value === null) {
    return (
      <div className="tv-gauge-card">
        <div className="tv-gauge-title">RSI</div>
        <div className="tv-na-text">N/A</div>
      </div>
    );
  }

  const value = clamp(rsi.value, 0, 100);
  const markerLeft = (value / 100) * 100;
  const isOversold = value <= 30;
  const isOverbought = value >= 70;
  const zoneLabel = isOversold ? 'Oversold' : isOverbought ? 'Overbought' : 'Neutral';
  const zoneColor = isOversold ? '#3fb950' : isOverbought ? '#f85149' : '#d29922';

  const velArrow = rsi.direction === 'RISING'
    ? (rsi.velocity === 'ACCELERATING' ? '\u2191\u2191' : '\u2191')
    : (rsi.velocity === 'ACCELERATING' ? '\u2193\u2193' : '\u2193');

  return (
    <div className="tv-gauge-card">
      <div className="tv-gauge-title">RSI (14)</div>
      <div className="tv-rsi-bar-wrapper">
        <div className="tv-rsi-bar">
          <div className="tv-rsi-zone tv-rsi-oversold" />
          <div className="tv-rsi-zone tv-rsi-neutral" />
          <div className="tv-rsi-zone tv-rsi-overbought" />
          <div
            className="tv-rsi-marker"
            style={{ left: `${markerLeft}%` }}
          >
            <div className="tv-rsi-needle" style={{ background: zoneColor }} />
          </div>
        </div>
        <div className="tv-rsi-scale">
          <span>0</span>
          <span className="tv-rsi-zone-label" style={{ left: '15%' }}>30</span>
          <span className="tv-rsi-zone-label" style={{ left: '70%' }}>70</span>
          <span>100</span>
        </div>
      </div>
      <div className="tv-rsi-readout">
        <span className="tv-rsi-value" style={{ color: zoneColor }}>
          {value.toFixed(1)}
        </span>
        <span className="tv-velocity-arrow" style={{ color: zoneColor }}>
          {velArrow}
        </span>
        <span className="tv-gauge-signal" style={{ color: zoneColor }}>
          {zoneLabel}
        </span>
      </div>
      <div className="tv-velocity-text">{velocityLabel(rsi)}</div>
    </div>
  );
}

function MovingAverageStatus({ technicals }: { technicals: ParsedTechnicals }) {
  const { sma50, sma200, currentPrice } = technicals;

  if (!sma50 && !sma200) {
    return (
      <div className="tv-gauge-card">
        <div className="tv-gauge-title">Moving Averages</div>
        <div className="tv-na-text">N/A</div>
      </div>
    );
  }

  // Determine cross signal
  let crossSignal: string = 'Neutral';
  let crossColor: string = '#d29922';
  let crossDescription: string = 'Insufficient data';

  if (sma50?.value != null && sma200?.value != null) {
    if (sma50.value > sma200.value) {
      crossSignal = 'Golden Cross';
      crossColor = '#3fb950';
      crossDescription = `SMA 50 (${sma50.value.toFixed(1)}) above SMA 200 (${sma200.value.toFixed(1)})`;
    } else {
      crossSignal = 'Death Cross';
      crossColor = '#f85149';
      crossDescription = `SMA 50 (${sma50.value.toFixed(1)}) below SMA 200 (${sma200.value.toFixed(1)})`;
    }
  }

  // Build MA items
  const items: Array<{
    label: string;
    value: number | null;
    priceRelation: string | null;
    bullish: boolean | null;
    velocity: string;
  }> = [];

  function addMA(label: string, ind: IndicatorData | null) {
    if (!ind) return;
    let priceRelation: string | null = null;
    let bullish: boolean | null = null;
    if (currentPrice != null && ind.value != null) {
      if (currentPrice > ind.value) {
        priceRelation = 'Price above';
        bullish = true;
      } else {
        priceRelation = 'Price below';
        bullish = false;
      }
    }
    items.push({
      label,
      value: ind.value,
      priceRelation,
      bullish,
      velocity: velocityLabel(ind),
    });
  }

  addMA('SMA 50', sma50);
  addMA('SMA 200', sma200);

  return (
    <div className="tv-gauge-card">
      <div className="tv-gauge-title">Moving Averages</div>

      <div className="tv-ma-cross-badge" style={{ borderColor: crossColor, color: crossColor }}>
        <span className="tv-ma-cross-icon" style={{ color: crossColor }}>
          {crossSignal === 'Golden Cross' ? '\u2726' : crossSignal === 'Death Cross' ? '\u2620' : '\u25CF'}
        </span>
        {crossSignal}
      </div>
      <div className="tv-ma-cross-desc">{crossDescription}</div>

      <div className="tv-ma-list">
        {items.map((item) => (
          <div className="tv-ma-item" key={item.label}>
            <div className="tv-ma-item-header">
              <span className="tv-ma-item-label">{item.label}</span>
              <span className="tv-ma-item-value">
                {item.value != null ? item.value.toFixed(2) : 'N/A'}
              </span>
            </div>
            <div className="tv-ma-item-details">
              {item.priceRelation && (
                <span
                  className="tv-ma-relation-badge"
                  style={{ color: signalColor(item.bullish) }}
                >
                  {item.priceRelation}
                </span>
              )}
              <span className="tv-ma-velocity">{item.velocity}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendStrengthMeter({ technicals }: { technicals: ParsedTechnicals }) {
  // Compute overall trend strength 0-100 based on alignment of signals
  let bullishSignals = 0;
  let bearishSignals = 0;
  let totalSignals = 0;

  function countSignal(ind: IndicatorData | null, bullishWhenRising: boolean) {
    if (!ind) return;
    totalSignals++;
    const isBullishDir = ind.direction === 'RISING';
    const isBullish = bullishWhenRising ? isBullishDir : !isBullishDir;
    if (isBullish) bullishSignals++;
    else bearishSignals++;
  }

  countSignal(technicals.sma50, true);
  countSignal(technicals.sma200, true);
  countSignal(technicals.macd, true);
  countSignal(technicals.macdSignal, true);
  countSignal(technicals.rsi, true);
  countSignal(technicals.bollMiddle, true);

  if (totalSignals === 0) {
    return (
      <div className="tv-gauge-card">
        <div className="tv-gauge-title">Trend Strength</div>
        <div className="tv-na-text">N/A</div>
      </div>
    );
  }

  const bullPct = Math.round((bullishSignals / totalSignals) * 100);
  const bearPct = Math.round((bearishSignals / totalSignals) * 100);
  const dominantSide = bullPct >= bearPct ? 'Bull' : 'Bear';
  const strength = Math.max(bullPct, bearPct);
  const dominantColor = dominantSide === 'Bull' ? '#3fb950' : '#f85149';

  // Count accelerating signals for intensity
  let accelerating = 0;
  [technicals.macd, technicals.rsi, technicals.bollMiddle, technicals.sma50].forEach((ind) => {
    if (ind?.velocity === 'ACCELERATING') accelerating++;
  });
  const intensityLabel = accelerating >= 3 ? 'High Intensity' : accelerating >= 1 ? 'Moderate' : 'Low Intensity';

  return (
    <div className="tv-gauge-card">
      <div className="tv-gauge-title">Trend Strength</div>
      <div className="tv-strength-ring-wrapper">
        <div
          className="tv-strength-ring"
          style={{
            background: `conic-gradient(
              ${dominantColor} 0deg,
              ${dominantColor} ${strength * 3.6}deg,
              #21262d ${strength * 3.6}deg,
              #21262d 360deg
            )`,
          }}
        >
          <div className="tv-strength-ring-inner">
            <span className="tv-strength-pct" style={{ color: dominantColor }}>
              {strength}%
            </span>
            <span className="tv-strength-side" style={{ color: dominantColor }}>
              {dominantSide}
            </span>
          </div>
        </div>
      </div>
      <div className="tv-strength-details">
        <div className="tv-strength-row">
          <span className="tv-strength-detail-label">Bullish Signals</span>
          <span style={{ color: '#3fb950' }}>{bullishSignals}/{totalSignals}</span>
        </div>
        <div className="tv-strength-row">
          <span className="tv-strength-detail-label">Bearish Signals</span>
          <span style={{ color: '#f85149' }}>{bearishSignals}/{totalSignals}</span>
        </div>
        <div className="tv-strength-row">
          <span className="tv-strength-detail-label">Intensity</span>
          <span className="tv-intensity-badge">{intensityLabel}</span>
        </div>
      </div>
    </div>
  );
}

function VolumeIndicator({ technicals }: { technicals: ParsedTechnicals }) {
  // Use Bollinger Band width as a proxy for volatility/volume activity
  const { bollUpper, bollLower, bollMiddle, currentPrice } = technicals;

  if (!bollUpper?.value || !bollLower?.value || !bollMiddle?.value) {
    return (
      <div className="tv-gauge-card">
        <div className="tv-gauge-title">Volatility</div>
        <div className="tv-na-text">N/A</div>
      </div>
    );
  }

  const bandWidth = bollUpper.value - bollLower.value;
  const bandPct = (bandWidth / bollMiddle.value) * 100;
  const isExpanding = bollUpper.direction === 'RISING' && bollLower.direction === 'FALLING';
  const isContracting = bollUpper.direction === 'FALLING' && bollLower.direction === 'RISING';

  let volatilityStatus = 'Normal';
  let statusColor = '#d29922';
  if (bandPct > 30) {
    volatilityStatus = 'High';
    statusColor = '#f85149';
  } else if (bandPct < 10) {
    volatilityStatus = 'Low';
    statusColor = '#3fb950';
  }

  // Show price position within bands
  let pricePosition: number | null = null;
  if (currentPrice != null) {
    pricePosition = ((currentPrice - bollLower.value) / bandWidth) * 100;
    pricePosition = clamp(pricePosition, 0, 100);
  }

  const volBarFill = clamp(bandPct * 2, 5, 100);

  return (
    <div className="tv-gauge-card">
      <div className="tv-gauge-title">Volatility (Bollinger)</div>

      <div className="tv-vol-status-row">
        <span className="tv-vol-status" style={{ color: statusColor }}>{volatilityStatus}</span>
        <span className="tv-vol-pct">{bandPct.toFixed(1)}% width</span>
      </div>

      <div className="tv-vol-bar-wrapper">
        <div className="tv-vol-bar-bg">
          <div
            className="tv-vol-bar-fill"
            style={{ width: `${volBarFill}%`, background: statusColor }}
          />
        </div>
      </div>

      <div className="tv-vol-expansion">
        {isExpanding && (
          <span className="tv-vol-tag tv-vol-tag-expand">Bands Expanding</span>
        )}
        {isContracting && (
          <span className="tv-vol-tag tv-vol-tag-contract">Bands Contracting</span>
        )}
        {!isExpanding && !isContracting && (
          <span className="tv-vol-tag">Bands Shifting</span>
        )}
      </div>

      {pricePosition !== null && (
        <div className="tv-vol-price-pos">
          <div className="tv-vol-price-label">Price in Band</div>
          <div className="tv-vol-band-visual">
            <div className="tv-vol-band-track">
              <div
                className="tv-vol-band-marker"
                style={{ left: `${pricePosition}%` }}
              />
            </div>
            <div className="tv-vol-band-labels">
              <span>Lower</span>
              <span>Upper</span>
            </div>
          </div>
        </div>
      )}

      <div className="tv-vol-values">
        <div className="tv-vol-value-item">
          <span className="tv-vol-val-label">Upper</span>
          <span className="tv-vol-val-num">{bollUpper.value.toFixed(2)}</span>
        </div>
        <div className="tv-vol-value-item">
          <span className="tv-vol-val-label">Middle</span>
          <span className="tv-vol-val-num">{bollMiddle.value.toFixed(2)}</span>
        </div>
        <div className="tv-vol-value-item">
          <span className="tv-vol-val-label">Lower</span>
          <span className="tv-vol-val-num">{bollLower.value.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/*  Main component                                         */
/* ────────────────────────────────────────────────────── */

export default function TrendVisualization({ data }: TrendVisualizationProps) {
  const marketReport = data?.analysts?.market?.report_markdown;

  if (!marketReport) {
    return (
      <div className="tv-container card">
        <h2 className="card-title">Trend Visualization</h2>
        <div className="tv-na-text">No market analyst data available.</div>
      </div>
    );
  }

  const technicals = parseTechnicals(marketReport);
  const bias = parseDirectionalBias(marketReport);

  return (
    <div className="tv-container card">
      <div className="tv-header">
        <h2 className="card-title tv-main-title">Trend Visualization</h2>
        {bias && (
          <div className="tv-bias-badge-row">
            <span
              className="tv-bias-badge"
              style={{
                color: bias.bias.toLowerCase() === 'bullish' ? '#3fb950' : '#f85149',
                borderColor: bias.bias.toLowerCase() === 'bullish' ? 'rgba(63,185,80,0.4)' : 'rgba(248,81,73,0.4)',
                background: bias.bias.toLowerCase() === 'bullish' ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
              }}
            >
              {bias.bias} Bias
            </span>
            <span className="tv-bias-conf">
              Confidence: {bias.confidence}
            </span>
          </div>
        )}
        {technicals.currentPrice != null && (
          <div className="tv-current-price">
            Current Price: <span className="tv-price-value">${technicals.currentPrice.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="tv-gauges-grid">
        <MomentumGauge technicals={technicals} />
        <RSIGauge rsi={technicals.rsi} />
        <MovingAverageStatus technicals={technicals} />
        <TrendStrengthMeter technicals={technicals} />
        <VolumeIndicator technicals={technicals} />
      </div>
    </div>
  );
}
