import { useEffect, useMemo, useState } from "react";
import { Clock, LogIn, LogOut, RefreshCw, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState, panelClass, SectionHeader } from "@/components/Navigation";
import { ProfileTrigger } from "@/components/portal/ProfileViewer";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import {
  dayKey,
  formatMinutes,
  listAttendance,
  minutesBetween,
  openSession,
  signIn,
  signOut,
  useOpsVersion,
} from "@/lib/portalOps";

/**
 * Live attendance: students, staff and administrators sign themselves in and
 * out. Elapsed time updates every second while a session is open.
 */
export default function AttendanceSign() {
  const { currentUser, state } = useApp();
  useOpsVersion();
  const [date, setDate] = useState(dayKey());
  const [note, setNote] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const open = currentUser ? openSession(currentUser.id) : undefined;

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const rows = useMemo(() => listAttendance(date), [date, open, now === 0]);

  if (!currentUser) return null;

  const elapsed = open ? minutesBetween(open.signInAt) : 0;
  const totalToday = rows.reduce((sum, row) => sum + minutesBetween(row.signInAt, row.signOutAt), 0);
  const onSite = rows.filter((row) => !row.signOutAt).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Live attendance"
        description="Sign in when you arrive and sign out when you leave. Every role records the same register."
      />

      <div className={cn(panelClass, "p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="text-lg font-semibold">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground">
              {currentUser.role}
              {currentUser.accountNumber ? ` · ${currentUser.accountNumber}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {open ? "Session started" : "Status"}
            </p>
            <p className="text-lg font-semibold">
              {open
                ? new Date(open.signInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "Not signed in"}
            </p>
            {open && (
              <p className="flex items-center justify-end gap-1 text-sm text-emerald-600">
                <Clock className="h-4 w-4" /> {formatMinutes(elapsed)} on site
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="attendance-note" className="text-xs uppercase tracking-wide text-muted-foreground">
              Note (optional)
            </label>
            <Input
              id="attendance-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. teaching Cohort B, morning shift"
              disabled={!!open}
            />
          </div>
          {open ? (
            <Button
              variant="destructive"
              onClick={() => {
                const closed = signOut(currentUser.id);
                if (closed) {
                  toast.success(
                    `Signed out after ${formatMinutes(minutesBetween(closed.signInAt, closed.signOutAt))}.`,
                  );
                }
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          ) : (
            <Button
              onClick={() => {
                signIn(
                  { id: currentUser.id, name: currentUser.name, role: currentUser.role },
                  note,
                );
                setNote("");
                toast.success("Signed in. Your session is now open.");
              }}
            >
              <LogIn className="mr-2 h-4 w-4" /> Sign in
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label htmlFor="attendance-date" className="mr-2 text-sm text-muted-foreground">
            Register date
          </label>
          <Input
            id="attendance-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || dayKey())}
            className="inline-flex w-auto"
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => setDate(dayKey())}>
          <RefreshCw className="mr-2 h-4 w-4" /> Today
        </Button>
        <div className="ml-auto flex flex-wrap gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{rows.length} sessions</Badge>
          <Badge variant="secondary">{onSite} on site now</Badge>
          <Badge variant="secondary">{formatMinutes(totalToday)} total</Badge>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No sign-ins for this date"
          description="Once someone signs in, their session appears here in real time."
        />
      ) : (
        <div className={cn(panelClass, "overflow-x-auto")}>
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Person</th>
                <th className="p-3">Role</th>
                <th className="p-3">Sign in</th>
                <th className="p-3">Sign out</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const account = state.users.find((u) => u.id === row.userId);
                const live = !row.signOutAt;
                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">
                      <ProfileTrigger user={account}>{row.userName}</ProfileTrigger>
                    </td>
                    <td className="p-3 text-muted-foreground">{row.role}</td>
                    <td className="p-3">
                      {new Date(row.signInAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3">
                      {row.signOutAt ? (
                        new Date(row.signOutAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-700" variant="outline">
                          <UserCheck className="mr-1 h-3 w-3" /> on site
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      {formatMinutes(minutesBetween(row.signInAt, row.signOutAt))}
                      {live ? " …" : ""}
                    </td>
                    <td className="p-3 text-muted-foreground">{row.note || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
