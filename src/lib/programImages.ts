import type { Program } from "@/types";

/**
 * Programme photography: admin-uploaded `program.imageUrl` always wins,
 * otherwise programmes show the official November 2026 Africa of Hope mark.
 */
export const AFRICAN_PROGRAM_IMAGE =
  "https://files.monstarx.app/jk0454jkv1/public/uploads/chat/7ynjatu3oi/Aoh-favicon.png";

export const DEFAULT_PROGRAM_IMAGE = AFRICAN_PROGRAM_IMAGE;

export function stockImageFor(_title: string): string {
  return AFRICAN_PROGRAM_IMAGE;
}

export function programImage(program: Pick<Program, "title" | "imageUrl">): string {
  return program.imageUrl || AFRICAN_PROGRAM_IMAGE;
}
