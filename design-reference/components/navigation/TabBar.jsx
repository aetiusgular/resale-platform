import React from 'react';

const CSS = `
.pv-tabs{display:flex;align-items:baseline;gap:32px;border-bottom:1px solid var(--line);margin:0;padding:0}
.pv-tab{position:relative;appearance:none;background:none;border:none;margin:0;padding:0 0 12px;font-family:var(--font-ui,'Inter',sans-serif);font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-soft);cursor:pointer;transition:color 120ms linear}
.pv-tab:hover:not(:disabled){color:var(--ink)}
.pv-tab:disabled{opacity:.35;cursor:not-allowed}
.pv-tab--active,.pv-tab--active:hover:not(:disabled){color:var(--accent)}
.pv-tab--active::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:1px;background:var(--accent)}
.pv-tab__count{margin-left:6px;font-family:var(--font-mono,'Space Mono',monospace);font-size:11px;font-weight:400;letter-spacing:0;color:var(--ink-soft)}
`;

function inject() {
  if (typeof document !== 'undefined' && !document.getElementById('pv-css-tabs')) {
    const s = document.createElement('style');
    s.id = 'pv-css-tabs';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
}

export function TabBar({ tabs = [], activeId, onChange, ariaLabel, style }) {
  inject();
  return (
    <div className="pv-tabs" role="tablist" aria-label={ariaLabel} style={style}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === activeId}
          disabled={t.disabled}
          className={'pv-tab' + (t.id === activeId ? ' pv-tab--active' : '')}
          onClick={() => { if (onChange) onChange(t.id); }}
        >
          {t.label}
          {t.count !== undefined ? <span className="pv-tab__count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
