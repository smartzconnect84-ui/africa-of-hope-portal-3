import { useEffect, useMemo, useState } from "react";
import { Check, Search, Users } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { createChatGroup, chatErrorText, type GroupSummary } from "@/lib/messaging";
import { displayRole } from "@/lib/roleDisplay";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { User } from "@/types";

export default function NewChatDialog({
  open,
  mode,
  people,
  meId,
  onClose,
  onPickUser,
  onCreated,
}: {
  open: boolean;
  mode: "direct" | "group";
  people: User[];
  meId: string;
  onClose: () => void;
  onPickUser: (user: User) => void;
  onCreated: (group: GroupSummary) => void;
}) {
  const [tab, setTab] = useState<"direct" | "group">(mode);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab(mode);
    setQuery("");
    setName("");
    setDescription("");
    setSelected([]);
    setError(null);
  }, [open, mode]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((user) => `${user.name} ${user.email ?? ""} ${user.role}`.toLowerCase().includes(q));
  }, [people, query]);

  async function createGroup() {
    if (!name.trim()) {
      setError("Give the group a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const group = await createChatGroup({
        name: name.trim(),
        description: description.trim(),
        createdBy: meId,
        memberIds: selected,
      });
      onCreated({
        id: group.id,
        name: group.name,
        description: group.description,
        avatarUrl: group.avatar_url,
        backgroundUrl: group.background_url,
        ownerId: group.ownerId,
        memberIds: group.memberIds,
      });
      onClose();
    } catch (err) {
      setError(chatErrorText(err, "The group could not be created."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Message a member privately, or gather a cohort or team into a group.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2" role="tablist" aria-label="Conversation type">
          {(
            [
              { id: "direct", label: "Direct message" },
              { id: "group", label: "New group" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "h-9 rounded-full px-3.5 text-[12.5px] font-semibold transition",
                tab === item.id ? "bg-[#075e54] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "group" && (
          <div className="space-y-2.5">
            <div>
              <label htmlFor="new-group-name" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Group name
              </label>
              <input
                id="new-group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="e.g. Tailoring cohort A"
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] outline-none focus:border-[#25d366] focus:ring-2 focus:ring-[#25d366]/20"
              />
            </div>
            <div>
              <label
                htmlFor="new-group-description"
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              >
                Description (optional)
              </label>
              <input
                id="new-group-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={200}
                placeholder="What this group is for"
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] outline-none focus:border-[#25d366] focus:ring-2 focus:ring-[#25d366]/20"
              />
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email or role"
            aria-label="Search members"
            className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-2.5 text-[13px] outline-none focus:border-[#25d366] focus:ring-2 focus:ring-[#25d366]/20"
          />
        </div>

        {tab === "group" && (
          <p className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
            <Users className="h-3.5 w-3.5" /> {selected.length} selected
          </p>
        )}

        <ul className="max-h-[280px] space-y-0.5 overflow-y-auto">
          {matches.length === 0 && (
            <li className="py-6 text-center text-[12px] text-slate-500">No members match that search.</li>
          )}
          {matches.map((user) => {
            const chosen = selected.includes(user.id);
            return (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (tab === "direct") {
                      onPickUser(user);
                      onClose();
                      return;
                    }
                    setSelected((current) =>
                      current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id],
                    );
                  }}
                  aria-pressed={tab === "group" ? chosen : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50",
                    chosen && "bg-emerald-50",
                  )}
                >
                  <UserAvatar user={user} className="h-9 w-9 text-[11px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-800">{user.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {displayRole(user.role)}
                      {user.email ? ` · ${user.email}` : ""}
                    </span>
                  </span>
                  {tab === "group" && (
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                        chosen ? "border-[#25d366] bg-[#25d366] text-white" : "border-slate-300",
                      )}
                    >
                      {chosen && <Check className="h-3 w-3" />}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
            {error}
          </p>
        )}

        {tab === "group" && (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-full border border-slate-200 px-4 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createGroup()}
              disabled={saving || !name.trim()}
              className="h-9 rounded-full bg-[#075e54] px-4 text-[12.5px] font-semibold text-white hover:bg-[#054d45] disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create group"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
