Text field with a floating ALL-CAPS 12px label that settles on the top border; 44px, 1px --line, 2px radius.

```jsx
<Input label="Email" type="email" />
<Input label="Asking price" mono placeholder="$0" hint="USD. Fees deducted at sale." />
<Input label="Email" error="Enter a valid email address." defaultValue="not-an-email" />
<Input label="Username" disabled defaultValue="@objectdealer" />
```

- Focus: border + label sharpen to --ink. Error: both go --alert with a 12px message.
- `mono` renders the value in Space Mono — required for price/size/measurement fields.
- Label floats on focus or when the field has a value; placeholder appears only after float.
