import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE, fadeUpVariants, staggerContainer } from "./motionConstants";

/**
 * Shared scroll-reveal/stagger components for the public site refresh.
 * Unlike `Reveal` in `Navigation.tsx` (which animates in on mount), these
 * trigger once the element enters the viewport — used for below-the-fold
 * public content so first paint and header elements stay snappy.
 * Transform/opacity only, `viewport={{ once: true }}`, and `useReducedMotion`
 * is honoured everywhere so users who ask for less motion get an instant,
 * static layout.
 */

export function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={{
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** Wrap a group of children in this, then give each child `variants={fadeUpVariants}` for a staggered reveal. */
export function StaggerGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  );
}

/** A single hover/press-animated card wrapper — lift + shadow on hover, scale on press. */
export function MotionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={fadeUpVariants}
      whileHover={{ y: -6, transition: { duration: 0.2, ease: EASE } }}
    >
      {children}
    </motion.div>
  );
}
