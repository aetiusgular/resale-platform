import * as React from 'react';

/**
 * Centered dialog — white panel, 1px --line border, 2px radius, the one
 * permitted shadow. Overlay is a white veil (rgba(255,255,255,.85)), no blur.
 */
export interface ModalProps {
  open: boolean;
  /** Inter 20px/600 sentence case */
  title: React.ReactNode;
  /** 14px Inter body */
  children?: React.ReactNode;
  /** Right-aligned actions, usually <Button> pair (secondary + primary) */
  footer?: React.ReactNode;
  /** Called on ×, Escape, or veil click */
  onClose?: () => void;
  /** Panel max-width in px (default 480) */
  width?: number;
  style?: React.CSSProperties;
}

export declare function Modal(props: ModalProps): React.ReactElement | null;
