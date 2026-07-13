import React from 'react';

const CSS = `
.pv-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;height:var(--control-h,44px);padding:0 24px;border-radius:var(--radius,2px);font-family:var(--font-ui,'Inter',sans-serif);font-size:14px;font-weight:500;letter-spacing:-0.01em;line-height:1;cursor:pointer;transition:background-color 120ms linear,color 120ms linear,border-color 120ms linear,opacity 120ms linear}
.pv-btn:active:not(:disabled){opacity:.8}
.pv-btn:disabled{opacity:.35;cursor:not-allowed}
.pv-btn--primary{background:var(--ink);color:var(--bg);border:1px solid var(--ink)}
.pv-btn--primary:hover:not(:disabled){opacity:.9}
.pv-btn--secondary{background:var(--bg);color:var(--ink);border:1px solid var(--ink)}
.pv-btn--secondary:hover:not(:disabled){background:var(--ink);color:var(--bg)}
.pv-btn--text{background:transparent;color:var(--ink);border:1px solid transparent;padding:0 8px}
.pv-btn--text:hover:not(:disabled){text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px}
.pv-btn--destructive.pv-btn--primary{background:var(--alert);border-color:var(--alert)}
.pv-btn--destructive.pv-btn--secondary{color:var(--alert);border-color:var(--alert)}
.pv-btn--destructive.pv-btn--secondary:hover:not(:disabled){background:var(--alert);color:var(--bg)}
.pv-btn--destructive.pv-btn--text{color:var(--alert)}
.pv-btn--full{width:100%}
`;

function inject() {
  if (typeof document !== 'undefined' && !document.getElementById('pv-css-button')) {
    const s = document.createElement('style');
    s.id = 'pv-css-button';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
}

export function Button({
  variant = 'primary',
  destructive = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
  onClick,
  children,
  style,
}) {
  inject();
  const cls = [
    'pv-btn',
    'pv-btn--' + variant,
    destructive ? 'pv-btn--destructive' : '',
    fullWidth ? 'pv-btn--full' : '',
  ].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick} style={style}>
      {children}
    </button>
  );
}
