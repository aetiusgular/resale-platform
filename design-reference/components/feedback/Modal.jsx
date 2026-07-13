import React from 'react';

const CSS = `
.pv-modal-veil{position:fixed;inset:0;background:var(--overlay,rgba(255,255,255,0.85));display:flex;align-items:center;justify-content:center;padding:24px;z-index:100}
.pv-modal{box-sizing:border-box;display:flex;flex-direction:column;gap:24px;width:100%;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius,2px);box-shadow:var(--shadow-1,0 1px 2px rgba(0,0,0,0.06));padding:32px;max-height:calc(100vh - 48px);overflow-y:auto}
.pv-modal__head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.pv-modal__title{font-family:var(--font-ui,'Inter',sans-serif);font-size:20px;font-weight:600;letter-spacing:-0.01em;line-height:1.2;color:var(--ink)}
.pv-modal__x{flex:none;background:none;border:none;padding:0;margin:-2px 0 0;font-size:16px;line-height:1;color:var(--ink-soft);cursor:pointer;transition:color 120ms linear}
.pv-modal__x:hover{color:var(--ink)}
.pv-modal__body{font-family:var(--font-ui,'Inter',sans-serif);font-size:14px;line-height:1.6;color:var(--ink)}
.pv-modal__foot{display:flex;justify-content:flex-end;gap:8px}
`;

function inject() {
  if (typeof document !== 'undefined' && !document.getElementById('pv-css-modal')) {
    const s = document.createElement('style');
    s.id = 'pv-css-modal';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
}

export function Modal({ open = false, title, children, footer, onClose, width = 480, style }) {
  inject();

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="pv-modal-veil"
      onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <div className="pv-modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} style={{ maxWidth: width, ...style }}>
        <div className="pv-modal__head">
          <div className="pv-modal__title">{title}</div>
          {onClose ? (
            <button type="button" className="pv-modal__x" aria-label="Close" onClick={onClose}>
              {'\u00D7'}
            </button>
          ) : null}
        </div>
        {children ? <div className="pv-modal__body">{children}</div> : null}
        {footer ? <div className="pv-modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
