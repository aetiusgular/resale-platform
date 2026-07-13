import * as React from 'react';

/**
 * Seller tier chip — text only, Space Mono 11px caps in a 1px bordered 2px-radius
 * pill. Hierarchy by contrast, never metallic color: Bronze --line/--ink-soft,
 * Silver --line/--ink, Gold --ink border, Platinum --accent border.
 */
export interface TierBadgeProps {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  style?: React.CSSProperties;
}

export declare function TierBadge(props: TierBadgeProps): React.ReactElement;
