import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { DELIVERY_META, costSummary, durationLabel, programModes } from "@/lib/programDelivery";
import type { Program, SystemSettings } from "@/types";
import { buttonMotionProps } from "./motionConstants";
import { cn } from "@/lib/utils";

/** Public link to the programme catalogue (the public site is hash-routed). */
export function programmeShareUrl(): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/#programmes`;
}

/**
 * Prefilled WhatsApp message: the course, its length, how it is studied and the
 * registration package. Family and friends get the useful facts, not a bare link.
 */
export function programShareMessage(program: Program, settings: SystemSettings): string {
  const cost = costSummary(program, settings);
  const modes = programModes(program)
    .map((mode) => DELIVERY_META[mode].label)
    .join(" / ");
  const lines = [
    `Hello! AFRICA OF HOPE is offering ${program.title}${program.category ? ` (${program.category})` : ""}.`,
    `Duration: ${durationLabel(program)}.`,
    modes ? `How you study: ${modes}.` : "",
    `Registration: ${cost.registration}; tuition is ${cost.tuition.toLowerCase()}.`,
    `See the course and apply here: ${programmeShareUrl()}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function whatsappShareLink(program: Program, settings: SystemSettings): string {
  return `https://wa.me/?text=${encodeURIComponent(programShareMessage(program, settings))}`;
}

/**
 * f66 — one-tap WhatsApp sharing for a single programme.
 * Opens WhatsApp (app or web) with the message already written; a prospect only
 * has to pick a contact and send.
 */
export default function WhatsAppShareButton({
  program,
  variant = "outline",
  className,
  label = "Share on WhatsApp",
}: {
  program: Program;
  variant?: "outline" | "ghost";
  className?: string;
  label?: string;
}) {
  const { state } = useApp();
  const href = whatsappShareLink(program, state.settings);

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Share ${program.title} on WhatsApp`}
      title="Share this programme on WhatsApp"
      {...buttonMotionProps}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition",
        variant === "outline"
          ? "border-[#25D366] bg-white text-[#0f7a3d] hover:bg-[#25D366]/10 hover:text-[#0b5f30]"
          : "border-transparent bg-transparent text-[#0f7a3d] hover:bg-[#25D366]/10",
        className,
      )}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {label}
    </motion.a>
  );
}
