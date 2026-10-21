import { Children, isValidElement, type ReactNode } from 'react';
import { DEFAULT_LAYOUT } from '@/data/publicPresentation';

/** Sort React children, not just their CSS positions, so reading/tab order matches. */
export default function OrderedSections({ order, children }: { order?: string[]; children: ReactNode }) {
  const complete = [...new Set([...(order || DEFAULT_LAYOUT), ...DEFAULT_LAYOUT])];
  return <>{Children.toArray(children).sort((a, b) => {
    const rank = (node: ReactNode) => {
      if (!isValidElement(node)) return -1;
      const key = String(node.key || '').replace(/^.*\$/, '');
      return complete.includes(key) ? complete.indexOf(key) : -1;
    };
    return rank(a) - rank(b);
  })}</>;
}
