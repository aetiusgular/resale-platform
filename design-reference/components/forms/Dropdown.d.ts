import * as React from 'react';

export interface DropdownOption {
  value: string;
  label: string;
}

/**
 * Single-select dropdown. Input-shaped trigger (44px, 1px --line, floating caps
 * label) with a flush white menu; typographic ▾/▴ caret, no icons.
 */
export interface DropdownProps {
  /** Field label — Inter 12px ALL CAPS, floats to the top border */
  label: string;
  /** Options — strings or {value, label} pairs */
  options: (DropdownOption | string)[];
  /** Currently selected option value */
  value?: string;
  onChange?: (value: string) => void;
  /** Ghost text shown once open with nothing selected */
  placeholder?: string;
  disabled?: boolean;
  /** Error message — 12px --alert line below; border and label go --alert */
  error?: string;
  hint?: string;
  style?: React.CSSProperties;
}

export declare function Dropdown(props: DropdownProps): React.ReactElement;
