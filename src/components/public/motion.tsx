import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE, fadeUpVariants, staggerContainer } from "./motionConstants";

/**
 * Shared scroll-reveal/stagger components for the public site.
 * Transform/opacity only, `viewport={{ once: true }}`, reduced-motion safe.
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
        hidden: { opacity: 0, y: 28, filter: "blur(4px)" },
        visible: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.6, delay, ease: EASE },
        },
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

/**
 * Hover/press-animated card wrapper — lift + shadow + subtle scale.
 * Pair with the `aoh-card` CSS class for the shadow/glow finish.
 */
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
      whileHover={{ y: -6, scale: 1.01, transition: { duration: 0.22, ease: EASE } }}
      whileTap={{ scale: 0.99 }}
    >
      {children}
    </motion.div>
  );
}
