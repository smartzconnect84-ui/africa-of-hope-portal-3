import type { Variants } from "framer-motion";

/**
 * Plain constants shared by the public-site motion components in
 * `./motion.tsx`. Kept in a separate module (not a `.tsx` component file) so
 * Vite's fast-refresh lint rule (`react-refresh/only-export-components`)
 * stays happy — a component file may only export components.
 */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};

/** Press/hover affordance for buttons and tappable chips (scale only — no layout shift). */
export const buttonMotionProps = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.15, ease: EASE },
};
