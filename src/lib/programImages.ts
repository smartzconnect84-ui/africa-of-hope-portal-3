import type { Program } from "@/types";

/**
 * Programme photography: admin-uploaded `program.imageUrl` always wins,
 * otherwise every programme shows the African student group photo supplied
 * by the owner (mixed-ethnicity, high quality).
 */
export const AFRICAN_PROGRAM_IMAGE =
  "https://files.monstarx.app/54c3deukza/public/uploads/chat/sczxaz2gix/file_0000000009d471fdb2483f23fe455e94.png";

export const DEFAULT_PROGRAM_IMAGE = AFRICAN_PROGRAM_IMAGE;

export function stockImageFor(_title: string): string {
  return AFRICAN_PROGRAM_IMAGE;
}

export function programImage(program: Pick<Program, "title" | "imageUrl">): string {
  return program.imageUrl || AFRICAN_PROGRAM_IMAGE;
}
