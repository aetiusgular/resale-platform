import * as React from 'react';

/**
 * Marketplace listing record: 3:4 image on white, all data in Space Mono.
 * Borderless — a 1px --line outline appears on hover only, offset 8px.
 * @startingPoint section="Components" subtitle="3:4 listing record, mono data, hover-only border" viewport="280x480"
 */
export interface ListingCardProps {
  /** One line, truncates — e.g. "Raf Simons Consumed Bomber AW03" */
  title: string;
  /** Preformatted mono price — e.g. "$1,240" */
  price: string;
  /** e.g. "EU 48" or "M" */
  size?: string;
  /** Condition score as "8/10" */
  condition?: string;
  /** Renders the 11px --accent VERIFIED mark. Semantic record mark; keep density low. */
  verified?: boolean;
  /** 3:4 product photograph on white. Omit for the mono "3 : 4" placeholder frame. */
  imageSrc?: string;
  imageAlt?: string;
  /** Renders the card as a link */
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export declare function ListingCard(props: ListingCardProps): React.ReactElement;
