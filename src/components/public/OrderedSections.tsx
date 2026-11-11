import { Children, isValidElement, type ReactNode } from 'react';
import { DEFAULT_LAYOUT, LEGACY_DEFAULT_LAYOUT } from '@/data/publicPresentation';

/**
 * Sort React children, not just their CSS positions, so reading/tab order matches.
 * One-time relevance migration: a CMS layout that exactly matches the
 * pre-restructure default is upgraded to the relevance-first default so every
 * site gets the improved journey (decision-critical sections first) without
 * touching any custom order or hidden-section choice an admin saved.
 */
function migrateLegacyOrder(order: string[]): string[] {
  const same =
    order.length === LEGACY_DEFAULT_LAYOUT.length &&
    order.every((key, i) => key === LEGACY_DEFAULT_LAYOUT[i]);
  return same ? [...DEFAULT_LAYOUT] : order;
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
