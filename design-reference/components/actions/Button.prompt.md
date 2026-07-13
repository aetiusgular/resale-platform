The only action control: 44px / 2px radius / Inter 500 sentence-case verb labels; hovers are quiet (primary 90% opacity, secondary fills ink, text underlines).

```jsx
<Button>Make offer</Button>
<Button variant="secondary">Save</Button>
<Button variant="text">View history</Button>
<Button variant="secondary" destructive>Open dispute</Button>
<Button disabled>Make offer</Button>
```

- `variant`: `primary` (solid #111, white text) · `secondary` (1px #111 border, white bg) · `text`
- `destructive`: alert red — dispute/error actions only
- Labels: 1–2 word verbs, sentence case, never caps, no icons
