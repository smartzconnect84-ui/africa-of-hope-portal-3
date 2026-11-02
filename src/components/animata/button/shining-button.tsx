import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ShiningButtonProps {
  href?: string;
  onClick?: () => void;
  label?: string;
}

export default function ShiningButton({ href = "#term-dates", onClick, label = "See Calendar" }: ShiningButtonProps) {
  const inner = (
    <span className="relative flex items-center justify-center gap-4 overflow-hidden rounded-lg bg-violet-800 px-6 py-4 font-bold text-white">
      {label}
      <ArrowRight className="transition-all duration-700 ease-in-out group-hover/shine:translate-x-2 group-hover/shine:scale-125" />
      <span
        className={cn(
          "absolute -left-16 top-0 h-full w-12 rotate-[30deg] scale-y-150 bg-white/10 transition-all duration-700 ease-in-out group-hover/shine:left-[calc(100%+1rem)]",
        )}
        aria-hidden
      />
    </span>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group/shine cursor-pointer rounded-xl border-4 border-violet-800/0 bg-transparent p-1 transition-colors duration-500 hover:border-violet-800/100"
      >
        {inner}
      </button>
    );
  }
  return (
    <a
      href={href}
      className="group/shine inline-block cursor-pointer rounded-xl border-4 border-violet-800/0 bg-transparent p-1 transition-colors duration-500 hover:border-violet-800/100"
    >
      {inner}
    </a>
  );
}
