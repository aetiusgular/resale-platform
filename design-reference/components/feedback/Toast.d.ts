import * as React from 'react';

/**
 * Toast notification — white, 1px --line border, the one permitted shadow.
 * Optional mono caps status line colored by variant. Registrar tone:
 * "Authenticated. Certificate added to the listing."
 */
export interface ToastProps {
  /** Mono caps status label, e.g. "AUTHENTICATED", "SAVED", "PAYMENT FAILED" */
  status?: string;
  /** Inter 14px body — factual, no exclamation points */
  message: React.ReactNode;
  /** success = --accent status (budget use) · error = --alert status */
  variant?: 'default' | 'success' | 'error';
  /** Shows the typographic × dismisser */
  onDismiss?: () => void;
  style?: React.CSSProperties;
}

export declare function Toast(props: ToastProps): React.ReactElement;
