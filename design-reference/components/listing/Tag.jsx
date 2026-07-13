import React from 'react';

const CSS = `
.pv-tag{box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 10px;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius,2px);font-family:var(--font-mono,'Space Mono',monospace);font-weight:400;font-size:11px;line-height:1;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink);white-space:nowrap;transition:border-color 120ms linear,background-color 120ms linear,color 120ms linear}
button.pv-tag{cursor:pointer}
button.pv-tag:hover:not(:disabled){border-color:var(--ink)}
.pv-tag--selected,button.pv-tag--selected:hover:not(:disabled){background:var(--ink);border-color:var(--ink);color:var(--bg)}
.pv-tag--authenticated{border-color:var(--accent);color:var(--accent)}
button.pv-tag--authenticated:hover:not(:disabled){border-color:var(--accent)}
.pv-tag:disabled{opacity:.35;cursor:not-allowed}
.pv-tag__x{display:inline-flex;align-items:center;justify-content:center;background:none;border:none;padding:0;margin:0 -2px 0 0;font-family:inherit;font-size:12px;line-height:1;color:inherit;opacity:.6;cursor:pointer;transition:opacity 120ms linear}
.pv-tag__x:hover{opacity:1}
`;

function inject() {
  if (typeof document !== 'undefined' && !document.getElementById('pv-css-tag')) {
    const s = document.createElement('style');
    s.id = 'pv-css-tag';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
}

export function Tag({
  children,
  variant = 'default',
  selected = false,
  disabled = false,
  onClick,
  onRemove,
  style,
}) {
  inject();
  const cls = [
    'pv-tag',
    variant === 'authenticated' ? 'pv-tag--authenticated' : '',
    selected ? 'pv-tag--selected' : '',
  ].filter(Boolean).join(' ');

  const inner = (
    <React.Fragment>
      <span>{children}</span>
      {onRemove ? (
        <button
          type="button"
          className="pv-tag__x"
          aria-label="Remove"
          onClick={(e) => { e.stopPropagation(); onRemove(e); }}
        >
          {'\u00D7'}
        </button>
      ) : null}
    </React.Fragment>
  );

  if (onClick) {
    return (
      <button type="button" className={cls} disabled={disabled} onClick={onClick} style={style} aria-pressed={selected}>
        {inner}
      </button>
    );
  }
  return <span className={cls} style={style}>{inner}</span>;
}
