Quiet notification card (white, 1px --line, 0 1px 2px shadow) with a mono caps status line — green for success, alert red for errors, ink otherwise.

```jsx
<Toast status="Authenticated" variant="success"
  message="Certificate added to the listing." onDismiss={close} />
<Toast status="Payment failed" variant="error"
  message="Payment declined. No funds were taken." onDismiss={close} />
<Toast status="Saved" message="Added to your watchlist." />
```

- Position fixed bottom-right (24px inset) in application chrome; component renders the card only.
- Copy is registrar-factual: no exclamation points, no emoji.
- `variant="success"` consumes the view's accent budget.
