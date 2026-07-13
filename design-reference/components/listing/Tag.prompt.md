Mono caps chip for filters and record marks; selection inverts to solid ink, removal is a typographic ×, and `authenticated` is the reserved --accent variant.

```jsx
<Tag onClick={toggle}>Outerwear</Tag>
<Tag selected onClick={toggle}>EU 48</Tag>
<Tag onRemove={clear}>Raf Simons</Tag>
<Tag variant="authenticated">Authenticated</Tag>
```

- Space Mono 11px caps, 28px, 1px --line border; hover sharpens border to --ink.
- `selected`: ink fill / white text (selection ≠ accent; accent stays budgeted).
- `variant="authenticated"`: --accent border + text — an authentication record mark only.
