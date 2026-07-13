import React from 'react';

const CSS = `
.pv-card{display:block;background:var(--bg);color:var(--ink);text-decoration:none;outline:1px solid transparent;outline-offset:8px;transition:outline-color 120ms linear;cursor:pointer;min-width:0}
.pv-card:hover{outline-color:var(--line)}
.pv-card:focus-visible{outline:1px solid var(--ink)}
.pv-card__media{position:relative;aspect-ratio:3/4;width:100%;background:var(--bg);overflow:hidden}
.pv-card__img{display:block;width:100%;height:100%;object-fit:cover}
.pv-card__ph{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;height:100%;border:1px solid var(--line);font-family:var(--font-mono,'Space Mono',monospace);font-size:12px;letter-spacing:0.08em;color:var(--ink-soft)}
.pv-card__body{padding-top:12px;display:flex;flex-direction:column;gap:4px}
.pv-card__title{font-family:var(--font-mono,'Space Mono',monospace);font-weight:700;font-size:14px;line-height:1.4;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv-card__price{font-family:var(--font-mono,'Space Mono',monospace);font-weight:400;font-size:14px;line-height:1.4;color:var(--ink)}
.pv-card__meta{font-family:var(--font-mono,'Space Mono',monospace);font-weight:400;font-size:12px;line-height:1.4;color:var(--ink-soft)}
.pv-card__verified{margin-top:4px;font-family:var(--font-mono,'Space Mono',monospace);font-weight:700;font-size:11px;letter-spacing:0.08em;color:var(--accent)}
`;

function inject() {
  if (typeof document !== 'undefined' && !document.getElementById('pv-css-listingcard')) {
    const s = document.createElement('style');
    s.id = 'pv-css-listingcard';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
}

export function ListingCard({
  title,
  price,
  size,
  condition,
  verified = false,
  imageSrc,
  imageAlt,
  href,
  onClick,
  style,
}) {
  inject();
  const Tag = href ? 'a' : 'div';
  const meta = [size, condition].filter(Boolean).join(' \u00B7 ');
  return (
    <Tag className="pv-card" href={href} onClick={onClick} style={style} tabIndex={href ? undefined : 0}>
      <div className="pv-card__media">
        {imageSrc
          ? <img className="pv-card__img" src={imageSrc} alt={imageAlt || title} />
          : <div className="pv-card__ph" aria-label="No photograph on record">3 : 4</div>}
      </div>
      <div className="pv-card__body">
        <div className="pv-card__title">{title}</div>
        <div className="pv-card__price">{price}</div>
        {meta ? <div className="pv-card__meta">{meta}</div> : null}
        {verified ? <div className="pv-card__verified">VERIFIED</div> : null}
      </div>
    </Tag>
  );
}
