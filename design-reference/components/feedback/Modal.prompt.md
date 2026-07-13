Centered white dialog behind a white veil (no blur, no dark overlay): 1px --line border, 32px padding, 20px sentence-case title, right-aligned Button pair.

```jsx
<Modal
  open={open}
  title="Remove listing"
  onClose={close}
  footer={
    <React.Fragment>
      <Button variant="secondary" onClick={close}>Keep</Button>
      <Button onClick={confirm}>Remove</Button>
    </React.Fragment>
  }
>
  The listing and its offer history will be removed from the archive.
</Modal>
```

- Veil is --bg at 85% (`--overlay`) — the gallery stays white; never darken or blur.
- Closes on ×, Escape, and veil click.
- Destructive confirmations use `<Button destructive>`.
