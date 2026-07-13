Caps-label tabs on a single 1px rule; the active tab carries the view's accent (green text + 1px green underline), everything else stays soft ink.

```jsx
<TabBar
  ariaLabel="Categories"
  tabs={[
    { id: 'all', label: 'All', count: 412 },
    { id: 'outerwear', label: 'Outerwear', count: 128 },
    { id: 'denim', label: 'Denim' },
    { id: 'archive', label: 'Archive', disabled: true },
  ]}
  activeId={cat}
  onChange={setCat}
/>
```

- Inter 12px ALL CAPS +0.08em; counts in Space Mono 11px.
- Active = --accent text + 1px --accent underline (this consumes the view's accent budget).
- Hover darkens --ink-soft → --ink. 32px between tabs.
