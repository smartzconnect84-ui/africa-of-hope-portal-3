import { useEffect, useState } from "react";
import type { User } from "@/types";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
}

/** Round avatar that shows the profile photo and falls back to initials. */
export default function UserAvatar({ user, className }: { user: Pick<User, "name" | "avatarUrl">; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [user.avatarUrl]);
  return user.avatarUrl && !broken ? (
    <img
      src={user.avatarUrl}
      alt={user.name}
      onError={() => setBroken(true)}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  ) : (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-900 font-semibold text-white",
        className,
      )}
    >
      {initials(user.name)}
    </span>
  );
}
