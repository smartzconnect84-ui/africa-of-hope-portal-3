import type { ReactNode } from "react";
import { useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Users2,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/context/AppContext";
import type { User } from "@/types";
import { cn } from "@/lib/utils";
import {
  presenceLabel,
  presenceOf,
  usePresenceHeartbeat,
  usePresencePeers,
  type PresenceState,
} from "@/lib/portalOps";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function PresenceDot({ state, className }: { state: PresenceState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full ring-2 ring-background",
        state === "online" && "bg-emerald-500",
        state === "away" && "bg-amber-500",
        state === "offline" && "bg-muted-foreground/40",
        className,
      )}
      aria-hidden="true"
    />
  );
}

export function PresenceBadge({ userId }: { userId: string }) {
  usePresencePeers();
  const state = presenceOf(userId);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <PresenceDot state={state} />
      {presenceLabel(state)}
    </span>
  );
}

function Avatar({ user, size = "lg" }: { user: User; size?: "sm" | "lg" }) {
  const dimension = size === "lg" ? "h-20 w-20 text-2xl" : "h-10 w-10 text-sm";
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={`${user.name} profile photo`}
        className={cn("shrink-0 rounded-full object-cover", dimension)}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
        dimension,
      )}
      aria-hidden="true"
    >
      {initials(user.name)}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value?: ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="break-words text-sm">{value}</div>
      </div>
    </div>
  );
}

export function UserProfileDialog({
  user,
  open,
  onOpenChange,
}: {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state } = useApp();
  usePresencePeers();

  if (!user) return null;

  const programs = state.programs.filter((p) => user.programIds?.includes(p.id));
  const cohorts = (state.cohorts ?? []).filter(
    (c) => user.cohortIds?.includes(c.id) || c.teacherId === user.id,
  );
  const state_ = presenceOf(user.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar user={user} />
              <PresenceDot
                state={state_}
                className="absolute bottom-1 right-1 h-4 w-4 ring-4 ring-background"
              />
            </div>
            <div className="min-w-0 flex-1 text-left">
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {user.name}
                {user.status === "Active" && <BadgeCheck className="h-4 w-4 text-emerald-500" />}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {user.title || user.role}
                {user.accountNumber ? ` · ${user.accountNumber}` : ""}
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{user.role}</Badge>
                <Badge variant={user.status === "Active" ? "default" : "secondary"}>{user.status}</Badge>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <PresenceDot state={state_} />
                  {presenceLabel(state_)}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-x-8 sm:grid-cols-2">
          <DetailRow
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            value={
              user.email ? (
                <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${user.email}`}>
                  {user.email}
                </a>
              ) : undefined
            }
          />
          <DetailRow
            icon={<Phone className="h-4 w-4" />}
            label="Phone"
            value={
              user.phone ? (
                <a className="text-primary underline-offset-4 hover:underline" href={`tel:${user.phone}`}>
                  {user.phone}
                </a>
              ) : undefined
            }
          />
          <DetailRow
            icon={<CalendarDays className="h-4 w-4" />}
            label="Joined"
            value={user.joinedDate ? new Date(user.joinedDate).toLocaleDateString() : undefined}
          />
          <DetailRow
            icon={<GraduationCap className="h-4 w-4" />}
            label="Education level"
            value={user.educationLevel}
          />
          <DetailRow icon={<MapPin className="h-4 w-4" />} label="Address" value={user.address} />
          <DetailRow
            icon={<Building2 className="h-4 w-4" />}
            label="Account number"
            value={user.accountNumber}
          />
        </div>

        <div className="space-y-4 border-t pt-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4" /> Enrolled programmes
            </p>
            {programs.length ? (
              <div className="flex flex-wrap gap-2">
                {programs.map((program) => (
                  <Badge key={program.id} variant="secondary">
                    {program.title}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No programmes assigned yet.</p>
            )}
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Users2 className="h-4 w-4" /> Cohorts &amp; classes
            </p>
            {cohorts.length ? (
              <div className="flex flex-wrap gap-2">
                {cohorts.map((cohort) => (
                  <Badge key={cohort.id} variant="outline">
                    {cohort.name}
                    {cohort.teacherId === user.id ? " · instructor" : ""}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not assigned to a cohort.</p>
            )}
          </div>

          {user.bio && (
            <div>
              <p className="mb-1 text-sm font-medium">About</p>
              <p className="text-sm text-muted-foreground">{user.bio}</p>
            </div>
          )}

          {user.note && (
            <div>
              <p className="mb-1 text-sm font-medium">Administrative note</p>
              <p className="text-sm text-muted-foreground">{user.note}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Wrap any user name/avatar so clicking it opens their full profile.
 * Renders plain text when the account cannot be resolved.
 */
export function ProfileTrigger({
  user,
  children,
  className,
}: {
  user: User | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!user) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "text-left underline-offset-4 transition hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        title={`View ${user.name}'s profile`}
      >
        {children}
      </button>
      <UserProfileDialog user={user} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Mount once inside the portal so the signed-in account reports presence. */
export function PresenceHeartbeat() {
  const { currentUser } = useApp();
  usePresenceHeartbeat(
    currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : null,
  );
  return null;
}

export default UserProfileDialog;
