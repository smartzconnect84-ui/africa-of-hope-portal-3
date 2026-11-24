import { useEffect, useMemo, useState } from "react";
import { Camera, FileText, LogOut, UserPlus, X } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import {
  addGroupMembers,
  chatErrorText,
  fetchGroupMembers,
  fetchThread,
  leaveChatGroup,
  renameGroup,
  threadCacheKey,
  uploadGroupPhoto,
  useSignedUrl,
  type Conversation,
  type Message,
} from "@/lib/messaging";
import { displayRole } from "@/lib/roleDisplay";
import type { User } from "@/types";

function MediaTile({ message }: { message: Message }) {
  const url = useSignedUrl(message.attachment?.type === "image" ? message.attachment.path : null);
  if (!url) {
    return <div className="aspect-square animate-pulse rounded-md bg-slate-100" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md">
      <img src={url} alt={message.attachment?.name ?? "Shared image"} className="aspect-square w-full object-cover" />
    </a>
  );
}

export default function ContactInfoPanel({
  conversation,
  meId,
  users,
  online,
  onClose,
  onLeftGroup,
  onActivity,
}: {
  conversation: Conversation;
  meId: string;
  users: User[];
  online: boolean;
  onClose: () => void;
  onLeftGroup: () => void;
  onActivity: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<{ userId: string; role: string }[]>([]);
  const [name, setName] = useState(conversation.name);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [invitee, setInvitee] = useState("");
  const [error, setError] = useState<string | null>(null);

  const peer = conversation.peerId ? users.find((user) => user.id === conversation.peerId) : undefined;
  const byId = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  useEffect(() => {
    setMessages([]);
    setMembers([]);
    setName(conversation.name);
    setError(null);
    setConfirmLeave(false);
    const target =
      conversation.peerId
        ? ({ kind: "dm", peerId: conversation.peerId } as const)
        : conversation.groupId
          ? ({ kind: "group", groupId: conversation.groupId } as const)
          : null;
    if (!target) return;
    let cancelled = false;
    void fetchThread(meId, target)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch(() => undefined);
    if (conversation.kind === "group" && conversation.groupId) {
      void fetchGroupMembers(conversation.groupId).then((rows) => {
        if (!cancelled) setMembers(rows);
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.key, meId]);

  const media = messages.filter((message) => message.attachment && message.attachment.type !== "voice");
  const starred = messages.filter((message) => message.starred && !message.deleted_at);
  const isGroup = conversation.kind === "group";
  const canManageGroup = isGroup && conversation.ownerId === meId;
  const memberIds = members.length > 0 ? members.map((member) => member.userId) : conversation.memberIds ?? [];
  const invitees = users.filter((user) => !memberIds.includes(user.id));
  const cacheKey = threadCacheKey(meId, conversation.peerId ? { kind: "dm", peerId: conversation.peerId } : { kind: "group", groupId: conversation.groupId ?? "" });

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-slate-100 bg-white px-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close conversation info"
          className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-[14px] font-semibold text-slate-900">{isGroup ? "Group info" : "Contact info"}</h2>
      </header>

      <div className="border-b border-slate-100 px-4 py-5 text-center">
        <UserAvatar
          user={{ name: conversation.name, avatarUrl: conversation.avatarUrl }}
          className="mx-auto h-24 w-24 text-2xl"
        />
        <p className="mt-3 truncate text-[16px] font-semibold text-slate-900">{conversation.name}</p>
        <p className="mt-0.5 text-[12px] text-slate-500">
          {isGroup
            ? `${memberIds.length} member${memberIds.length === 1 ? "" : "s"}`
            : online
              ? "online now"
              : peer?.lastSeenAt
                ? `last seen ${new Date(peer.lastSeenAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                : displayRole(peer?.role ?? conversation.role ?? "") || "Portal member"}
        </p>
        {isGroup && conversation.ownerId === meId && (
          <p className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800">
            You created this group
          </p>
        )}
      </div>

      {!isGroup && (
        <div className="space-y-1.5 border-b border-slate-100 px-4 py-3 text-[12.5px]">
          {peer?.email && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Email</span>
              <span className="truncate text-slate-800">{peer.email}</span>
            </div>
          )}
          {peer?.phone && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Phone</span>
              <span className="truncate text-slate-800">{peer.phone}</span>
            </div>
          )}
          {peer?.role && (
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Role</span>
              <span className="truncate text-slate-800">{displayRole(peer.role)}</span>
            </div>
          )}
          {peer?.bio && <p className="pt-1 text-[12px] leading-relaxed text-slate-600">{peer.bio}</p>}
        </div>
      )}

      {isGroup && (
        <div className="space-y-3 border-b border-slate-100 px-4 py-3">
          {conversation.lastBody && (
            <p className="text-[12px] leading-relaxed text-slate-600">{conversation.lastBody}</p>
          )}
          {canManageGroup && (
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500" htmlFor="group-name">
                Group name
              </label>
              <div className="flex gap-2">
                <input
                  id="group-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 text-[12.5px] outline-none focus:border-[#25d366] focus:ring-2 focus:ring-[#25d366]/20"
                />
                <button
                  type="button"
                  disabled={saving || !name.trim() || name.trim() === conversation.name}
                  onClick={async () => {
                    if (!conversation.groupId) return;
                    setSaving(true);
                    try {
                      await renameGroup(conversation.groupId, name.trim());
                      onActivity();
                    } catch (err) {
                      setError(chatErrorText(err, "The group could not be renamed."));
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="h-9 shrink-0 rounded-lg bg-[#075e54] px-3 text-[12px] font-semibold text-white disabled:opacity-40"
                >
                  Save
                </button>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50">
                <Camera className="h-3.5 w-3.5" /> Change group photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file || !conversation.groupId) return;
                    setSaving(true);
                    try {
                      await uploadGroupPhoto(conversation.groupId, file);
                      onActivity();
                    } catch (err) {
                      setError(chatErrorText(err, "The photo could not be uploaded."));
                    } finally {
                      setSaving(false);
                    }
                  }}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {isGroup && (
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Members ({memberIds.length})
          </p>
          <ul className="space-y-1.5">
            {memberIds.map((id) => {
              const user = byId.get(id);
              return (
                <li key={id} className="flex items-center gap-2.5">
                  <UserAvatar
                    user={{ name: user?.name ?? "Member", avatarUrl: user?.avatarUrl }}
                    className="h-8 w-8 text-[11px]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-slate-800">
                      {user?.name ?? id}
                      {id === meId && <span className="ml-1 text-[10.5px] text-slate-400">you</span>}
                    </span>
                    <span className="block truncate text-[10.5px] text-slate-500">
                      {members.find((member) => member.userId === id)?.role === "owner"
                        ? "Group creator"
                        : displayRole(user?.role ?? "")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          {invitees.length > 0 && (
            <div className="mt-3 flex gap-2">
              <select
                value={invitee}
                onChange={(event) => setInvitee(event.target.value)}
                aria-label="Choose a member to add"
                className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-[12px] outline-none focus:border-[#25d366]"
              >
                <option value="">Add a member…</option>
                {invitees.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!invitee}
                onClick={async () => {
                  if (!conversation.groupId || !invitee) return;
                  try {
                    await addGroupMembers(conversation.groupId, [invitee]);
                    const rows = await fetchGroupMembers(conversation.groupId);
                    setMembers(rows);
                    setInvitee("");
                    onActivity();
                  } catch (err) {
                    setError(chatErrorText(err, "That member could not be added."));
                  }
                }}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-[#075e54] px-2.5 text-[12px] font-semibold text-white disabled:opacity-40"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          )}

          {confirmLeave ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
              Leave this group? You can be added again later.
              <button
                type="button"
                onClick={async () => {
                  if (!conversation.groupId) return;
                  try {
                    await leaveChatGroup(conversation.groupId, meId);
                    onLeftGroup();
                  } catch (err) {
                    setError(chatErrorText(err, "You could not leave the group."));
                  }
                }}
                className="ml-auto rounded-md bg-rose-600 px-2 py-1 font-semibold text-white"
              >
                Leave
              </button>
              <button type="button" onClick={() => setConfirmLeave(false)} className="text-rose-600 underline">
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[12px] font-medium text-rose-700 hover:bg-rose-50"
            >
              <LogOut className="h-3.5 w-3.5" /> Leave group
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mx-4 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
          {error}
        </p>
      )}

      <div className="px-4 py-4">
        <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Media, links and docs
          <span className="text-slate-400">{media.length}</span>
        </p>
        {media.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-[11.5px] text-slate-500">
            Photos and documents shared in this chat will appear here.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {media.slice(-9).map((message) =>
              message.attachment?.type === "image" ? (
                <MediaTile key={message.id} message={message} />
              ) : (
                <a
                  key={message.id}
                  href={`#msg-${message.id}`}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md bg-slate-100 p-1 text-center text-[9.5px] text-slate-600"
                  title={message.attachment?.name}
                >
                  <FileText className="h-4 w-4" />
                  <span className="line-clamp-2 break-all">{message.attachment?.name}</span>
                </a>
              ),
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-6">
        <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Starred messages
          <span className="text-slate-400">{starred.length}</span>
        </p>
        {starred.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-[11.5px] text-slate-500">
            Star a message to keep it within reach.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {starred.slice(-4).map((message) => (
              <li key={message.id}>
                <a
                  href={`#msg-${message.id}`}
                  className={cn(
                    "block truncate rounded-lg border border-amber-200/70 bg-amber-50/70 px-2.5 py-1.5 text-[11.5px] text-slate-700",
                  )}
                  data-thread={cacheKey}
                >
                  {message.body || message.attachment?.name || "Message"}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
