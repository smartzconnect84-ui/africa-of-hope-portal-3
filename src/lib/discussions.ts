import { academicApi, type DiscussionThread, type DiscussionReply } from "./academics";

type Pending = { id: string; thread: DiscussionThread } | { id: string; threadId: string; reply: DiscussionReply };
interface Store { threads: DiscussionThread[]; pending: Pending[]; }
const key = (userId: string) => `aoh-discussions-v2:${userId}`;
function read(userId: string): Store {
  try {
    const value = JSON.parse(localStorage.getItem(key(userId)) ?? "null");
    return value && Array.isArray(value.threads) && Array.isArray(value.pending) ? value : { threads: [], pending: [] };
  } catch { return { threads: [], pending: [] }; }
}
function write(userId: string, store: Store) {
  // Do not silently claim an offline draft was saved when storage is unavailable.
  localStorage.setItem(key(userId), JSON.stringify(store));
}
function overlay(threads: DiscussionThread[], pending: Pending[]): DiscussionThread[] {
  const map = new Map(threads.map((t) => [t.id, { ...t, replies: [...t.replies] }]));
  for (const op of pending) {
    if ("thread" in op && !map.has(op.thread.id)) map.set(op.thread.id, { ...op.thread, replies: [] });
    if ("reply" in op) {
      const t = map.get(op.threadId);
      if (t && !t.replies.some((r) => r.id === op.reply.id)) t.replies.push(op.reply);
    }
  }
  return [...map.values()];
}
export function cachedDiscussions(userId: string, cohorts: string[]) {
  const store = read(userId);
  return overlay(store.threads, store.pending).filter((t) => cohorts.includes(t.cohortId));
}
export function pendingDiscussionCount(userId: string) { return read(userId).pending.length; }
export function queueThread(userId: string, thread: DiscussionThread) {
  const store = read(userId);
  store.pending.push({ id: thread.id, thread });
  write(userId, store);
}
export function queueReply(userId: string, threadId: string, reply: DiscussionReply) {
  const store = read(userId);
  store.pending.push({ id: reply.id, threadId, reply });
  write(userId, store);
}
const running = new Map<string, Promise<DiscussionThread[]>>();
export function syncDiscussions(userId: string, cohorts: string[]): Promise<DiscussionThread[]> {
  const existing = running.get(userId);
  if (existing) return existing;
  const task = (async () => {
    if (!navigator.onLine) throw new Error("Offline. Unsent posts are saved only on this device; they will retry when online.");
    for (const op of read(userId).pending) {
      if ("thread" in op) {
        if (!cohorts.includes(op.thread.cohortId)) continue;
        await academicApi.postDiscussionThread(op.thread);
      } else {
        const thread = cachedDiscussions(userId, cohorts).find((t) => t.id === op.threadId);
        if (!thread) continue;
        await academicApi.postDiscussionReply(op.threadId, op.reply);
      }
      const latest = read(userId);
      latest.pending = latest.pending.filter((p) => p.id !== op.id);
      write(userId, latest);
    }
    const threads = await academicApi.discussionThreads(cohorts);
    const latest = read(userId);
    write(userId, { threads, pending: latest.pending });
    return overlay(threads, latest.pending);
  })();
  running.set(userId, task);
  void task.finally(() => running.delete(userId)).catch(() => {});
  return task;
}
