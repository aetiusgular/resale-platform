import React from 'react';

const CSS = `
.pv-input{display:flex;flex-direction:column;gap:6px;font-family:var(--font-ui,'Inter',sans-serif);min-width:0}
.pv-input__box{position:relative}
.pv-input__field{box-sizing:border-box;width:100%;height:var(--control-h,44px);padding:0 12px;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius,2px);font-family:var(--font-ui,'Inter',sans-serif);font-size:14px;color:var(--ink);transition:border-color 120ms linear}
.pv-input--mono .pv-input__field{font-family:var(--font-mono,'Space Mono',monospace)}
.pv-input__field::placeholder{color:var(--ink-soft);opacity:0;transition:opacity 120ms linear}
.pv-input--floated .pv-input__field::placeholder{opacity:1}
.pv-input__field:hover:not(:disabled){border-color:var(--ink-soft)}
.pv-input__field:focus{outline:none;border-color:var(--ink)}
.pv-input__label{position:absolute;left:9px;top:50%;transform:translateY(-50%);padding:0 4px;background:var(--bg);font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-soft);pointer-events:none;white-space:nowrap;transition:top 120ms linear,color 120ms linear}
.pv-input--floated .pv-input__label{top:0}
.pv-input--focused .pv-input__label{color:var(--ink)}
.pv-input--error .pv-input__field{border-color:var(--alert)}
.pv-input--error .pv-input__label{color:var(--alert)}
.pv-input__msg{font-size:12px;line-height:1.5;color:var(--ink-soft)}
.pv-input__msg--error{color:var(--alert)}
.pv-input--disabled{opacity:.45}
.pv-input--disabled .pv-input__field{cursor:not-allowed}
`;

function inject() {
  if (typeof document !== 'undefined' && !document.getElementById('pv-css-input')) {
    const s = document.createElement('style');
    s.id = 'pv-css-input';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
}

let uid = 0;

export function Input({
  label,
  value,
  defaultValue,
  onChange,
  type = 'text',
  name,
  id,
  mono = false,
  error,
  hint,
  disabled = false,
  required = false,
  placeholder,
  style,
}) {
  inject();
  const autoId = React.useRef(null);
  if (autoId.current === null) autoId.current = 'pv-input-' + ++uid;
  const inputId = id || autoId.current;

  const [inner, setInner] = React.useState(defaultValue !== undefined ? String(defaultValue) : '');
  const [focused, setFocused] = React.useState(false);
  const val = value !== undefined ? value : inner;
  const floated = focused || String(val).length > 0;

  const cls = [
    'pv-input',
    mono ? 'pv-input--mono' : '',
    floated ? 'pv-input--floated' : '',
    focused ? 'pv-input--focused' : '',
    error ? 'pv-input--error' : '',
    disabled ? 'pv-input--disabled' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} style={style}>
      <div className="pv-input__box">
        <input
          className="pv-input__field"
          id={inputId}
          name={name}
          type={type}
          value={val}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          onChange={(e) => { if (value === undefined) setInner(e.target.value); if (onChange) onChange(e); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <label className="pv-input__label" htmlFor={inputId}>
          {label}{required ? ' *' : ''}
        </label>
      </div>
      {error
        ? <div className="pv-input__msg pv-input__msg--error">{error}</div>
        : (hint ? <div className="pv-input__msg">{hint}</div> : null)}
    </div>
  );
}
