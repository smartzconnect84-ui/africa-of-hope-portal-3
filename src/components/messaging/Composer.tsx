import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Send,
  Smile,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatVoiceTime, useVoiceRecorder, type Message } from "@/lib/messaging";

const EMOJI = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩",
  "😘","😗","😚","😋","😜","🤪","🤗","🤔","🤭","🤫","😐","😑","😶","😏","😒","🙄",
  "😬","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","😵","🤯","🤠",
  "🥳","😎","🤓","🧐","😕","😟","🙁","😮","😯","😲","😳","🥺","😦","😨","😰","😥",
  "😢","😭","😱","😖","😣","😞","😓","😩","😫","😤","😡","😠","🤬","💀","💩","🤡",
  "👋","🤚","✋","🖖","👌","🤌","✌️","🤞","🫶","👏","🙌","🤝","🙏","💪","🫡","👀",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❣️","💯","🔥","⭐","✨","🎉","🎊",
  "👍","👎","✅","❌","⚠️","📌","📎","📝","📷","🎤","🎧","💬","📧","📦","📁","📊",
  "💰","💳","🏦","🛒","🚗","✈️","🏠","🏫","🏥","🌍","🌙","☀️","🌧️","⚡","🌈","🍎",
  "🍌","🍉","🍇","🍓","🍒","🥑","🍅","🥦","🌽","🍞","🧀","🍗","🍕","🍔","🍜","🍰",
  "☕","🍵","🥤","🍼","🥂","🎁","🎂","🎈","🏆","🥇","🎓","📚","🖊️","🖥️","⌛","🕒",
];

export interface ComposerSend {
  body: string;
}

export default function Composer({
  meId,
  threadKey,
  initialDraft,
  onDraftChange,
  onSend,
  onTyping,
  onAttach,
  replyTo,
  editing,
  onCancelReply,
  onCancelEdit,
  sending,
  uploading,
  disabled,
  error,
}: {
  meId: string;
  threadKey: string;
  initialDraft: string;
  onDraftChange: (value: string) => void;
  onSend: (payload: ComposerSend) => void;
  onTyping: () => void;
  onAttach: (file: File, caption: string, seconds?: number) => void;
  replyTo: Message | null;
  editing: Message | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  sending?: boolean;
  uploading?: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  const [value, setValue] = useState(initialDraft);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useVoiceRecorder();

  // A different conversation (or an edit being started) replaces the draft.
  useEffect(() => {
    setValue(initialDraft);
    setPending(null);
    setPreviewUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadKey]);

  useEffect(() => {
    if (editing) {
      setValue(editing.body);
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  useEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
  }, [value]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function chooseFile(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPending(file);
    setPreviewUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    setAttachOpen(false);
  }

  function clearPending() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPending(null);
    setPreviewUrl(null);
  }

  function submit() {
    if (disabled) return;
    const body = value.trim();
    if (pending) {
      onAttach(pending, body);
      clearPending();
      setValue("");
      onDraftChange("");
      return;
    }
    if (!body) return;
    onSend({ body });
    if (!editing) {
      setValue("");
      onDraftChange("");
    }
    setEmojiOpen(false);
  }

  async function toggleRecording() {
    if (!recorder.recording) {
      setAttachOpen(false);
      await recorder.start();
      return;
    }
    const result = await recorder.stop();
    if (!result) return;
    const extension = result.mime.includes("mp4") ? "m4a" : result.mime.includes("ogg") ? "ogg" : "webm";
    const file = new File([result.blob], `voice-${Date.now()}.${extension}`, { type: result.mime });
    onAttach(file, "", result.seconds);
  }

  return (
    <div className="relative border-t border-black/5 bg-[#f0f2f5] px-2 pb-2 pt-1.5 sm:px-3">
      {replyTo && (
        <div className="mb-1.5 flex items-start gap-2 rounded-lg border-l-[3px] border-[#25d366] bg-white px-2.5 py-1.5 shadow-sm">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold text-[#0a7c68]">
              Replying to {replyTo.sender_id === meId ? "yourself" : "message"}
            </p>
            <p className="line-clamp-1 text-[11.5px] text-slate-600">
              {replyTo.deleted_at ? "Message deleted" : replyTo.body || "Attachment"}
            </p>
          </div>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {editing && (
        <div className="mb-1.5 flex items-start gap-2 rounded-lg border-l-[3px] border-amber-400 bg-white px-2.5 py-1.5 shadow-sm">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold text-amber-600">Editing message</p>
            <p className="line-clamp-1 text-[11.5px] text-slate-600">{editing.body}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onCancelEdit();
              setValue("");
              onDraftChange("");
            }}
            aria-label="Cancel edit"
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {pending && (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 shadow-sm">
          {previewUrl ? (
            <img src={previewUrl} alt="Attachment preview" className="h-12 w-12 rounded object-cover" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded bg-slate-100 text-slate-500">
              <FileText className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-slate-800">{pending.name}</p>
            <p className="text-[10.5px] text-slate-500">{(pending.size / 1024).toFixed(0)} KB · add a caption or send</p>
          </div>
          <button type="button" onClick={clearPending} aria-label="Remove attachment" className="text-slate-400 hover:text-rose-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {recorder.recording && (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700 shadow-sm">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" />
          <span className="font-semibold">Recording {formatVoiceTime(recorder.seconds)}</span>
          <span className="hidden sm:inline text-rose-600/80">Tap the square to send</span>
          <button
            type="button"
            onClick={recorder.cancel}
            aria-label="Discard recording"
            className="ml-auto text-rose-600 hover:text-rose-800"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {(error || recorder.error) && (
        <p role="alert" className="mb-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-[11.5px] text-rose-700">
          {recorder.error || error}
        </p>
      )}

      {emojiOpen && (
        <div className="absolute bottom-[110%] left-2 z-30 grid max-h-56 w-[min(92vw,320px)] grid-cols-8 gap-0.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
          {EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                const next = value + emoji;
                setValue(next);
                onDraftChange(next);
                inputRef.current?.focus();
              }}
              className="grid h-8 w-8 place-items-center rounded text-[17px] hover:bg-slate-100"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {attachOpen && (
        <>
          <button
            type="button"
            aria-label="Close attachment menu"
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setAttachOpen(false)}
          />
          <div className="absolute bottom-[110%] left-2 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-[12.5px] text-slate-700 shadow-2xl">
            <button
              type="button"
              onClick={() => imageInput.current?.click()}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
            >
              <ImageIcon className="h-4 w-4 text-[#0a7c68]" /> Photo
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4 text-[#0a7c68]" /> Document
            </button>
            <button
              type="button"
              onClick={() => void toggleRecording()}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50"
            >
              <Mic className="h-4 w-4 text-[#0a7c68]" /> Voice note
            </button>
          </div>
        </>
      )}

      <div className="flex items-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            setEmojiOpen((open) => !open);
            setAttachOpen(false);
          }}
          aria-label="Emoji"
          aria-expanded={emojiOpen}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-black/5"
        >
          <Smile className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setAttachOpen((open) => !open);
            setEmojiOpen(false);
          }}
          aria-label="Attach a file"
          aria-expanded={attachOpen}
          disabled={uploading}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-black/5 disabled:opacity-40"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onDraftChange(event.target.value);
            onTyping();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={editing ? "Edit the message…" : "Type a message"}
          aria-label="Message"
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-transparent bg-white px-3 py-2.5 text-[13.5px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#25d366]/50 focus:ring-2 focus:ring-[#25d366]/20"
        />

        {value.trim() || pending ? (
          <button
            type="button"
            onClick={submit}
            disabled={sending || uploading || disabled}
            aria-label={editing ? "Save edit" : "Send message"}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#075e54] text-white shadow-sm transition hover:bg-[#054d45] disabled:opacity-50"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void toggleRecording()}
            disabled={uploading || disabled}
            aria-label={recorder.recording ? "Stop and send voice note" : "Record a voice note"}
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full shadow-sm transition",
              recorder.recording ? "bg-rose-600 text-white" : "bg-[#075e54] text-white hover:bg-[#054d45]",
            )}
          >
            {recorder.recording ? <Square className="h-4 w-4" /> : <Mic className="h-4.5 w-4.5" />}
          </button>
        )}
      </div>

      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) chooseFile(file);
        }}
      />
      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) chooseFile(file);
        }}
      />
    </div>
  );
}
