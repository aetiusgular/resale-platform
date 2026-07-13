import React from 'react';

const CSS = `
.pv-select{display:flex;flex-direction:column;gap:6px;position:relative;font-family:var(--font-ui,'Inter',sans-serif);min-width:0}
.pv-select__box{position:relative}
.pv-select__trigger{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;height:var(--control-h,44px);padding:0 12px;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius,2px);font-family:var(--font-ui,'Inter',sans-serif);font-size:14px;color:var(--ink);cursor:pointer;text-align:left;transition:border-color 120ms linear}
.pv-select__trigger:hover:not(:disabled){border-color:var(--ink-soft)}
.pv-select--open .pv-select__trigger,.pv-select__trigger:focus{outline:none;border-color:var(--ink)}
.pv-select__value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv-select__value--empty{color:var(--ink-soft)}
.pv-select__caret{flex:none;font-size:11px;line-height:1;color:var(--ink-soft)}
.pv-select--open .pv-select__caret{color:var(--ink)}
.pv-select__label{position:absolute;left:9px;top:50%;transform:translateY(-50%);padding:0 4px;background:var(--bg);font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-soft);pointer-events:none;white-space:nowrap;transition:top 120ms linear,color 120ms linear;z-index:1}
.pv-select--floated .pv-select__label{top:0}
.pv-select--open .pv-select__label{color:var(--ink)}
.pv-select__menu{position:absolute;top:100%;left:0;right:0;margin:-1px 0 0;padding:0;list-style:none;background:var(--bg);border:1px solid var(--ink);border-radius:var(--radius,2px);box-shadow:var(--shadow-1,0 1px 2px rgba(0,0,0,0.06));max-height:240px;overflow-y:auto;z-index:20}
.pv-select__opt{display:block;box-sizing:border-box;width:100%;padding:0 12px;height:40px;line-height:40px;background:none;border:none;font-family:var(--font-ui,'Inter',sans-serif);font-size:14px;color:var(--ink);text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv-select__opt--hl{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px}
.pv-select__opt--selected{color:var(--accent);font-weight:500}
.pv-select--error .pv-select__trigger{border-color:var(--alert)}
.pv-select--error .pv-select__label{color:var(--alert)}
.pv-select__msg{font-size:12px;line-height:1.5;color:var(--ink-soft)}
.pv-select__msg--error{color:var(--alert)}
.pv-select--disabled{opacity:.45}
.pv-select--disabled .pv-select__trigger{cursor:not-allowed}
`;

function inject() {
  if (typeof document !== 'undefined' && !document.getElementById('pv-css-select')) {
    const s = document.createElement('style');
    s.id = 'pv-css-select';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
}

export function Dropdown({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select',
  disabled = false,
  error,
  hint,
  style,
}) {
  inject();
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const [open, setOpen] = React.useState(false);
  const [hl, setHl] = React.useState(-1);
  const rootRef = React.useRef(null);

  const selected = opts.find((o) => o.value === value);
  const floated = open || !!selected;

  React.useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (o) => {
    setOpen(false);
    if (onChange) onChange(o.value);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); setHl(0); return; }
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setHl((h) => (h + d + opts.length) % opts.length);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) { setOpen(true); setHl(Math.max(0, opts.findIndex((o) => o.value === value))); }
      else if (hl >= 0 && opts[hl]) pick(opts[hl]);
    }
  };

  const cls = [
    'pv-select',
    open ? 'pv-select--open' : '',
    floated ? 'pv-select--floated' : '',
    error ? 'pv-select--error' : '',
    disabled ? 'pv-select--disabled' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} style={style} ref={rootRef}>
      <div className="pv-select__box">
        <button
          type="button"
          className="pv-select__trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onKeyDown}
        >
          <span className={'pv-select__value' + (selected ? '' : ' pv-select__value--empty')}>
            {selected ? selected.label : (floated ? placeholder : '')}
          </span>
          <span className="pv-select__caret" aria-hidden="true">{open ? '\u25B4' : '\u25BE'}</span>
        </button>
        <span className="pv-select__label">{label}</span>
        {open && (
          <ul className="pv-select__menu" role="listbox">
            {opts.map((o, i) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={[
                    'pv-select__opt',
                    i === hl ? 'pv-select__opt--hl' : '',
                    o.value === value ? 'pv-select__opt--selected' : '',
                  ].filter(Boolean).join(' ')}
                  onMouseEnter={() => setHl(i)}
                  onClick={() => pick(o)}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error
        ? <div className="pv-select__msg pv-select__msg--error">{error}</div>
        : (hint ? <div className="pv-select__msg">{hint}</div> : null)}
    </div>
  );
}
