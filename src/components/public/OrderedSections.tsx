import { Children, isValidElement, type ReactNode } from 'react';
import { DEFAULT_LAYOUT, LEGACY_DEFAULT_LAYOUT, LEGACY_RELEVANCE_LAYOUT } from '@/data/publicPresentation';

/**
 * Sort React children, not just their CSS positions, so reading/tab order matches.
 * One-time relevance migration: a CMS layout that exactly matches any
 * pre-modern default is upgraded to the modern nonprofit default so every
 * site gets the improved journey (mission → offer → proof → join) without
 * touching any custom order or hidden-section choice an admin saved.
 */
function migrateLegacyOrder(order: string[]): string[] {
  const matches = (legacy: string[]) =>
    order.length === legacy.length && order.every((key, i) => key === legacy[i]);
  if (matches(LEGACY_DEFAULT_LAYOUT) || matches(LEGACY_RELEVANCE_LAYOUT)) return [...DEFAULT_LAYOUT];
  return order;
}

export default function OrderedSections({ order, children }: { order?: string[]; children: ReactNode }) {
  const migrated = migrateLegacyOrder(order && order.length > 0 ? order : DEFAULT_LAYOUT);
  const complete = [...new Set([...migrated, ...DEFAULT_LAYOUT])];
  return <>{Children.toArray(children).sort((a, b) => {
    const rank = (node: ReactNode) => {
      if (!isValidElement(node)) return -1;
      const key = String(node.key || '').replace(/^.*\$/, '');
      return complete.includes(key) ? complete.indexOf(key) : -1;
    };
    return rank(a) - rank(b);
  })}</>;
}
