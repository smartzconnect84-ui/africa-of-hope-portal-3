import { useEffect, useState } from "react";
import type { User } from "@/types";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
}

/** Round avatar that shows the profile photo and falls back to initials.
 *  Clicking a photo opens it in a wider lightbox. */
export default function UserAvatar({ user, className, onClick }: { user: Pick<User, "name" | "avatarUrl">; className?: string; onClick?: () => void }) {
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setBroken(false), [user.avatarUrl]);

  const photo = user.avatarUrl && !broken;

  const handleClick = () => {
    if (onClick) onClick();
    if (photo) setOpen(true);
  };

  return (
    <>
      {photo ? (
        <img
          src={user.avatarUrl}
          alt={user.name}
          onError={() => setBroken(true)}
          onClick={handleClick}
          className={cn("shrink-0 rounded-full object-cover cursor-zoom-in", className)}
        />
      ) : (
        <span
          aria-hidden
          onClick={onClick}
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-900 font-semibold text-white",
            className,
          )}
        >
          {initials(user.name)}
        </span>
      )}
      {photo && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <img src={user.avatarUrl} alt={user.name} className="w-full rounded-lg object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}