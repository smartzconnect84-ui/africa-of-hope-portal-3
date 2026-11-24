import { useEffect, useMemo, useState } from "react";
import { MessageCircle, MessagesSquare, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { usePresence } from "@/lib/presence";
import { cn } from "@/lib/utils";
import {
  sendToThread,
  useInbox,
  type Conversation,
  type GroupSummary,
  type Message,
} from "@/lib/messaging";
import UserAvatar from "@/components/UserAvatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ChatList from "./ChatList";
import ConversationPane from "./ConversationPane";
import ContactInfoPanel from "./ContactInfoPanel";
import NewChatDialog from "./NewChatDialog";
import type { User } from "@/types";

function EmptyPane({ onNewChat, onNewGroup, canCreateGroup }: { onNewChat: () => void; onNewGroup: () => void; canCreateGroup: boolean }) {
  return (
    <div className="hidden h-full flex-1 flex-col items-center justify-center bg-[#f7f9f8] px-8 text-center md:flex">
      <span className="grid h-24 w-24 place-items-center rounded-full bg-[#e7f8ef] text-[#075e54]">
        <MessagesSquare className="h-11 w-11" />
      </span>
      <h2 className="mt-5 text-[22px] font-semibold text-slate-800">Africa of Hope Messages</h2>
      <p className="mt-2 max-w-md text-[13px] leading-relaxed text-slate-500">
        Send private messages to a member, or bring a cohort together in a group. Conversations stay in sync on every
        device you sign in to.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onNewChat}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#075e54] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#054d45]"
        >
          <MessageCircle className="h-4 w-4" /> New message
        </button>
        <button
          type="button"
          onClick={onNewGroup}
          disabled={!canCreateGroup}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Users className="h-4 w-4" /> New group
        </button>
      </div>
      <p className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-slate-400">
        <Search className="h-3.5 w-3.5" /> Search chats, people and message text from the panel on the left.
      </p>
    </div>
  );
}

export default function MessagingWorkspace() {
  const { state, currentUser } = useApp();
  const meId = currentUser?.id ?? "";
  const people = useMemo(
    () =>
      state.users
        .filter((user) => user.id !== meId)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.users, meId],
  );

  const [tick, setTick] = useState(0);
  const { conversations, groups, loading, error, capabilities } = useInbox(meId || undefined, people, tick);
  const { onlineIds } = usePresence(meId || null);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [pending, setPending] = useState<Conversation | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; mode: "direct" | "group" }>({ open: false, mode: "direct" });
  const [forwarding, setForwarding] = useState<Message | null>(null);

  const bump = () => setTick((value) => value + 1);

  function openPeer(peerId: string) {
    const user = people.find((person) => person.id === peerId);
    const key = `dm:${peerId}`;
    setPending({
      key,
      kind: "dm",
      peerId,
      name: user?.name ?? "Portal member",
      role: user?.role,
      avatarUrl: user?.avatarUrl,
      lastBody: "",
      lastAt: new Date().toISOString(),
      unread: 0,
    });
    setActiveKey(key);
    setInfoOpen(false);
  }

  function openGroup(groupId: string) {
    const summary = groups.find((group) => group.id === groupId);
    const key = `group:${groupId}`;
    setPending({
      key,
      kind: "group",
      groupId,
      name: summary?.name ?? "Group chat",
      avatarUrl: summary?.avatarUrl ?? undefined,
      lastBody: "",
      lastAt: new Date().toISOString(),
      unread: 0,
      memberIds: summary?.memberIds,
      memberCount: summary?.memberIds.length,
      ownerId: summary?.ownerId,
    });
    setActiveKey(key);
    setInfoOpen(false);
  }

  // The header bell and the member directory dispatch this event instead of
  // opening a second, separate messaging window.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ peerId?: string; groupId?: string }>).detail;
      if (detail?.peerId) openPeer(detail.peerId);
      else if (detail?.groupId) openGroup(detail.groupId);
    };
    window.addEventListener("aoh-open-messages", handler as EventListener);
    return () => window.removeEventListener("aoh-open-messages", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, groups]);

  // A destination stashed while the portal was still switching views.
  useEffect(() => {
    if (!meId) return;
    try {
      const raw = sessionStorage.getItem("aoh-messages-target");
      if (!raw) return;
      sessionStorage.removeItem("aoh-messages-target");
      const target = JSON.parse(raw) as { peerId?: string; groupId?: string };
      if (target.peerId) openPeer(target.peerId);
      else if (target.groupId) openGroup(target.groupId);
    } catch {
      /* malformed target is ignored */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId]);

  const stored = activeKey ? conversations.find((conversation) => conversation.key === activeKey) : undefined;
  const active: Conversation | null = stored ?? (pending?.key === activeKey ? pending : null);

  // Keep a freshly opened chat in step with the inbox once its row arrives.
  useEffect(() => {
    if (pending && stored) setPending(null);
  }, [pending, stored]);

  function handleCreated(group: GroupSummary) {
    setPending({
      key: `group:${group.id}`,
      kind: "group",
      groupId: group.id,
      name: group.name,
      avatarUrl: group.avatarUrl ?? undefined,
      lastBody: group.description || "No messages yet",
      lastAt: new Date().toISOString(),
      unread: 0,
      memberIds: group.memberIds,
      memberCount: group.memberIds.length,
      ownerId: group.ownerId,
    });
    setActiveKey(`group:${group.id}`);
    bump();
  }

  const canCreateGroup = capabilities?.groups !== false;

  if (!currentUser) {
    return (
      <div className="rounded-xl border border-emerald-900/10 bg-white p-10 text-center text-sm text-slate-500">
        Sign in to send and receive messages.
      </div>
    );
  }

  return (
    <div className="-m-4 flex h-[calc(100dvh-4rem)] overflow-hidden border-y border-black/10 bg-[#efeae2] sm:-m-5 lg:-m-6 xl:-m-8">
      <div className={cn("h-full shrink-0 border-r border-black/10", active ? "hidden md:flex" : "flex w-full md:w-auto")}>
        <ChatList
          conversations={conversations}
          activeKey={activeKey}
          onSelect={(conversation) => {
            setActiveKey(conversation.key);
            setInfoOpen(false);
          }}
          onNewChat={() => setDialog({ open: true, mode: "direct" })}
          onNewGroup={() => setDialog({ open: true, mode: "group" })}
          canCreateGroup={canCreateGroup}
          currentUser={currentUser}
          loading={loading}
          error={error}
          onlineIds={onlineIds}
        />
      </div>

      <div className="flex min-w-0 flex-1">
        {active ? (
          <ConversationPane
            key={active.key}
            conversation={active}
            meId={meId}
            users={state.users}
            onlineIds={onlineIds}
            onBack={() => setActiveKey(null)}
            onOpenInfo={() => setInfoOpen(true)}
            onForward={(message) => setForwarding(message)}
            onActivity={bump}
          />
        ) : (
          <EmptyPane
            onNewChat={() => setDialog({ open: true, mode: "direct" })}
            onNewGroup={() => setDialog({ open: true, mode: "group" })}
            canCreateGroup={canCreateGroup}
          />
        )}
      </div>

      {infoOpen && active && (
        <>
          <button
            type="button"
            aria-label="Close conversation info"
            onClick={() => setInfoOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          />
          <div className="fixed inset-y-0 right-0 z-40 w-[min(92vw,340px)] border-l border-black/10 shadow-2xl lg:static lg:z-auto lg:w-[340px] lg:shrink-0 lg:shadow-none">
            <ContactInfoPanel
              conversation={active}
              meId={meId}
              users={state.users}
              online={active.peerId ? onlineIds.includes(active.peerId) : false}
              onClose={() => setInfoOpen(false)}
              onLeftGroup={() => {
                setInfoOpen(false);
                setActiveKey(null);
                setPending(null);
                bump();
              }}
              onActivity={bump}
            />
          </div>
        </>
      )}

      <NewChatDialog
        open={dialog.open}
        mode={dialog.mode}
        people={people}
        meId={meId}
        onClose={() => setDialog((current) => ({ ...current, open: false }))}
        onPickUser={(user: User) => openPeer(user.id)}
        onCreated={handleCreated}
      />

      <Dialog open={!!forwarding} onOpenChange={(next) => !next && setForwarding(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forward message</DialogTitle>
            <DialogDescription>Send a copy of this message to another conversation.</DialogDescription>
          </DialogHeader>
          {forwarding && (
            <p className="rounded-lg border-l-[3px] border-[#25d366] bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
              {forwarding.body || forwarding.attachment?.name || "Message"}
            </p>
          )}
          <ul className="max-h-[320px] space-y-0.5 overflow-y-auto">
            {conversations.map((conversation) => (
              <li key={conversation.key}>
                <button
                  type="button"
                  onClick={async () => {
                    if (!forwarding) return;
                    const target =
                      conversation.kind === "dm" && conversation.peerId
                        ? ({ kind: "dm", peerId: conversation.peerId } as const)
                        : conversation.groupId
                          ? ({ kind: "group", groupId: conversation.groupId } as const)
                          : null;
                    if (!target) return;
                    // Text only: a private attachment path belongs to the
                    // original conversation and must not be re-pointed at a
                    // thread whose members may not be allowed to read it.
                    const ok = await sendToThread(meId, target, { body: forwarding.body });
                    if (ok) toast.success(`Forwarded to ${conversation.name}`);
                    else toast.error("The message could not be forwarded.");
                    setForwarding(null);
                    bump();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                >
                  <UserAvatar
                    user={{ name: conversation.name, avatarUrl: conversation.avatarUrl }}
                    className="h-9 w-9 text-[11px]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-800">{conversation.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {conversation.kind === "group" ? "Group" : conversation.role ?? "Direct message"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {conversations.length === 0 && (
              <li className="py-6 text-center text-[12px] text-slate-500">Start a conversation first.</li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
