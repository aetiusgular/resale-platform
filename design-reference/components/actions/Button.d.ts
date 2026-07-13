import * as React from 'react';

/**
 * Core action control. 44px tall, 2px radius, Inter 500, sentence case.
 */
export interface ButtonProps {
  /** 'primary' solid ink · 'secondary' 1px ink border on white · 'text' borderless */
  variant?: 'primary' | 'secondary' | 'text';
  /** Dispute/error actions only — swaps ink for --alert. Never decorative. */
  destructive?: boolean;
  disabled?: boolean;
  /** Stretch to container width */
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Label: 1–2 word verb, sentence case ("Make offer") */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function Button(props: ButtonProps): React.ReactElement;
