Single-select with an input-shaped 44px trigger, floating caps label, flush bordered menu, and typographic ▾/▴ caret — the selected option is the view's accent use.

```jsx
<Dropdown
  label="Condition"
  options={['10/10 — Deadstock', '9/10', '8/10', '7/10', '6/10 — Worn']}
  value={condition}
  onChange={setCondition}
/>
<Dropdown label="Size" options={sizes} error="Select a size to continue." />
```

- Menu rows hover with an underline; the selected row is --accent (counts toward the accent budget).
- Keyboard: arrows move, Enter selects, Escape closes.
- Strings or `{value, label}` objects both work as options.
