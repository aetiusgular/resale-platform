import * as React from 'react';

export interface TabItem {
  id: string;
  /** Rendered ALL CAPS at 12px — keep to one word where possible */
  label: string;
  /** Optional mono record count */
  count?: number | string;
  disabled?: boolean;
}

/**
 * Horizontal tab bar on a 1px --line rule. Labels are Inter 12px ALL CAPS
 * +0.08em; the active tab is the view's accent use: --accent text + 1px
 * --accent underline sitting on the rule.
 */
export interface TabBarProps {
  tabs: TabItem[];
  activeId: string;
  onChange?: (id: string) => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
}

export declare function TabBar(props: TabBarProps): React.ReactElement;
