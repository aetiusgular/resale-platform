import * as React from 'react';

/**
 * Tag / filter chip — Space Mono 11px caps, 28px tall, 1px border, 2px radius.
 * Selected inverts to solid ink. 'authenticated' variant is an --accent record
 * mark (counts toward the one-accent-per-view budget).
 */
export interface TagProps {
  /** Chip text — kept short: "OUTERWEAR", "EU 48", "AUTHENTICATED" */
  children: React.ReactNode;
  /** 'authenticated' = --accent border + text, reserved for authentication marks */
  variant?: 'default' | 'authenticated';
  /** Filter-selected state: solid --ink fill, white text */
  selected?: boolean;
  disabled?: boolean;
  /** Makes the chip a button (filter behavior) */
  onClick?: (e: React.MouseEvent) => void;
  /** Shows a typographic × remover */
  onRemove?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export declare function Tag(props: TagProps): React.ReactElement;
