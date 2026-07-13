import React from 'react';

const CSS = `
.pv-tier{box-sizing:border-box;display:inline-flex;align-items:center;height:22px;padding:0 8px;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius,2px);font-family:var(--font-mono,'Space Mono',monospace);font-weight:400;font-size:11px;line-height:1;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-soft);white-space:nowrap}
.pv-tier--silver{color:var(--ink)}
.pv-tier--gold{border-color:var(--ink);color:var(--ink)}
.pv-tier--platinum{border-color:var(--accent);color:var(--ink)}
`;

function inject() {
  if (typeof document !== 'undefined' && !document.getElementById('pv-css-tier')) {
    const s = document.createElement('style');
    s.id = 'pv-css-tier';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
}

export function TierBadge({ tier = 'bronze', style }) {
  inject();
  const t = String(tier).toLowerCase();
  return (
    <span className={'pv-tier pv-tier--' + t} style={style}>
      {t}
    </span>
  );
}
