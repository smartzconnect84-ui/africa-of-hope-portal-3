import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import type { Program } from "@/types";
import { openProgramBrochure } from "@/lib/programBrochure";

/** f34: one-click printable PDF brochure (print window → Save as PDF) with the transparent logo. */
export default function ProgramBrochureButton({
  program,
  variant = "outline",
  className,
}: {
  program: Program;
  variant?: "outline" | "ghost" | "secondary";
  className?: string;
}) {
  const { state } = useApp();
  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      aria-label={`Download ${program.title} brochure (PDF)`}
      onClick={() => openProgramBrochure(program, state.settings, state.websiteSettings)}
    >
      <FileDown data-icon="inline-start" /> Brochure
    </Button>
  );
}
