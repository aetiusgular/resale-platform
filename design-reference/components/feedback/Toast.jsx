import React from 'react';

const CSS = `
.pv-toast{box-sizing:border-box;display:flex;align-items:flex-start;gap:16px;width:360px;max-width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius,2px);box-shadow:var(--shadow-1,0 1px 2px rgba(0,0,0,0.06));padding:16px}
.pv-toast__body{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.pv-toast__status{font-family:var(--font-mono,'Space Mono',monospace);font-weight:700;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink)}
.pv-toast--success .pv-toast__status{color:var(--accent)}
.pv-toast--error .pv-toast__status{color:var(--alert)}
.pv-toast__msg{font-family:var(--font-ui,'Inter',sans-serif);font-size:14px;line-height:1.6;color:var(--ink)}
.pv-toast__x{flex:none;background:none;border:none;padding:0;margin:0;font-size:14px;line-height:1.4;color:var(--ink-soft);cursor:pointer;transition:color 120ms linear}
.pv-toast__x:hover{color:var(--ink)}
`;

function inject() {
  if (typeof document !== 'undefined' && !document.getElementById('pv-css-toast')) {
    const s = document.createElement('style');
    s.id = 'pv-css-toast';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
}

export function Toast({ status, message, variant = 'default', onDismiss, style }) {
  inject();
  const cls = [
    'pv-toast',
    variant !== 'default' ? 'pv-toast--' + variant : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls} role="status" style={style}>
      <div className="pv-toast__body">
        {status ? <div className="pv-toast__status">{status}</div> : null}
        <div className="pv-toast__msg">{message}</div>
      </div>
      {onDismiss ? (
        <button type="button" className="pv-toast__x" aria-label="Dismiss" onClick={onDismiss}>
          {'\u00D7'}
        </button>
      ) : null}
    </div>
  );
}
