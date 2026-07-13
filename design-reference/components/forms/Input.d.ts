import * as React from 'react';

/**
 * Text field with floating 12px caps label. 44px tall, 1px --line border, 2px radius.
 */
export interface InputProps {
  /** Field label — rendered as Inter 12px ALL CAPS, floats to the top border */
  label: string;
  /** Controlled value (leave undefined for uncontrolled) */
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  name?: string;
  id?: string;
  /** Space Mono value text — use for listing data fields (price, size, measurements) */
  mono?: boolean;
  /** Error message — 12px --alert line below; border and label go --alert */
  error?: string;
  /** Neutral helper line below (ignored while error is set) */
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  /** Shown only once the label has floated (focus) */
  placeholder?: string;
  style?: React.CSSProperties;
}

export declare function Input(props: InputProps): React.ReactElement;
