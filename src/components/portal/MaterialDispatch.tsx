import { useRef, useState } from "react";
import { Download, FileUp, Link2, Send, Trash2, Users2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, panelClass, SectionHeader } from "@/components/Navigation";
import { ProfileTrigger } from "@/components/portal/ProfileViewer";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import {
  MAX_MATERIAL_BYTES,
  deleteDispatchedMaterial,
  listDispatchedMaterials,
  materialsFor,
  sendMaterial,
  useOpsVersion,
} from "@/lib/portalOps";

/**
 * Teachers and administrators upload a file or paste a link and send it
 * straight to the students who need it. Students see only what was sent to them.
 */
export default function MaterialDispatch() {
  const { currentUser, state } = useApp();
  useOpsVersion();
  const fileInput = useRef<HTMLInputElement>(null);

  const isStaff = !!currentUser && currentUser.role !== "Student";
  const students = state.users.filter((u) => u.role === "Student");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [programId, setProgramId] = useState(state.programs[0]?.id ?? "");
  const [cohortId, setCohortId] = useState("");
  const [kind, setKind] = useState<"link" | "file">("link");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileData, setFileData] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);

  const received = currentUser ? materialsFor(currentUser.id) : [];
  const sent = listDispatchedMaterials();

  const cohortStudents = cohortId
    ? state.users.filter((u) => u.cohortIds?.includes(cohortId)).map((u) => u.id)
    : [];

  if (!currentUser) return null;

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_MATERIAL_BYTES) {
      toast.error(
        `That file is ${(file.size / 1_048_576).toFixed(1)} MB. Inline uploads are limited to 1.5 MB — paste a link for larger files.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileData(String(reader.result ?? ""));
      setFileName(file.name);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsDataURL(file);
  }

  function toggleRecipient(id: string) {
    setRecipients((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function handleSend() {
    if (!title.trim()) {
      toast.error("Give the material a title.");
      return;
    }
    if (kind === "link" && !url.trim()) {
      toast.error("Paste a link to share.");
      return;
    }
    if (kind === "file" && !fileData) {
      toast.error("Choose a file to upload.");
      return;
    }
    const targets = recipients.length ? recipients : cohortStudents;
    if (!targets.length) {
      toast.error("Select at least one student, or pick a cohort to send to.");
      return;
    }

    sendMaterial({
      title: title.trim(),
      description: description.trim(),
      kind,
      url: kind === "link" ? url.trim() : fileData,
      fileName: kind === "file" ? fileName : "",
      programId,
      cohortId: cohortId || null,
      recipientIds: targets,
      sentById: currentUser!.id,
      sentByName: currentUser!.name,
    });

    toast.success(`Material sent to ${targets.length} student${targets.length === 1 ? "" : "s"}.`);
    setTitle("");
    setDescription("");
    setUrl("");
    setFileName("");
    setFileData("");
    setRecipients([]);
    setCohortId("");
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={isStaff ? "Send course materials" : "Materials sent to me"}
        description={
          isStaff
            ? "Upload a document or paste a link, then send it directly to students."
            : "Everything your instructors and the administration have shared with you."
        }
      />

      {isStaff && (
        <div className={cn(panelClass, "space-y-4 p-5")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="material-title">Title</Label>
              <Input
                id="material-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Week 2 — Bookkeeping worksheet"
              />
            </div>
            <div>
              <Label htmlFor="material-program">Course</Label>
              <select
                id="material-program"
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Any course</option>
                {state.programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="material-cohort">Cohort (optional)</Label>
              <select
                id="material-cohort"
                value={cohortId}
                onChange={(e) => {
                  setCohortId(e.target.value);
                  const ids = state.users
                    .filter((u) => u.cohortIds?.includes(e.target.value))
                    .map((u) => u.id);
                  if (e.target.value) setRecipients(ids);
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">No cohort — choose students below</option>
                {(state.cohorts ?? []).map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="material-description">Instructions</Label>
              <Textarea
                id="material-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What should students do with this?"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={kind === "link" ? "default" : "outline"}
              onClick={() => setKind("link")}
            >
              <Link2 className="mr-2 h-4 w-4" /> Link
            </Button>
            <Button
              type="button"
              size="sm"
              variant={kind === "file" ? "default" : "outline"}
              onClick={() => setKind("file")}
            >
              <FileUp className="mr-2 h-4 w-4" /> Upload file
            </Button>
          </div>

          {kind === "link" ? (
            <div>
              <Label htmlFor="material-url">Material link</Label>
              <Input
                id="material-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/…"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="material-file">File (max 1.5 MB)</Label>
              <input
                id="material-file"
                ref={fileInput}
                type="file"
                onChange={(e) => handleFile(e.target.files?.[0])}
                className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              />
              {fileName && <p className="mt-1 text-xs text-muted-foreground">Selected: {fileName}</p>}
            </div>
          )}

          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Users2 className="h-4 w-4" /> Recipients ({recipients.length} selected)
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
              {students.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">No student accounts yet.</p>
              )}
              {students.map((student) => (
                <label
                  key={student.id}
                  className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={recipients.includes(student.id)}
                    onChange={() => toggleRecipient(student.id)}
                    className="h-4 w-4"
                  />
                  <span>{student.name}</span>
                  <span className="text-xs text-muted-foreground">{student.email}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSend}>
              <Send className="mr-2 h-4 w-4" /> Send material
            </Button>
          </div>
        </div>
      )}

      {!isStaff && (
        <div className="space-y-3">
          {received.length === 0 ? (
            <EmptyState
              title="Nothing sent yet"
              description="Materials shared by your instructors will appear here."
            />
          ) : (
            received.map((material) => (
              <article key={material.id} className={cn(panelClass, "p-5")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{material.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      From {material.sentByName} · {new Date(material.sentAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline">{material.kind === "file" ? "File" : "Link"}</Badge>
                </div>
                {material.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{material.description}</p>
                )}
                <a
                  href={material.url}
                  download={material.kind === "file" ? material.fileName || material.title : undefined}
                  target={material.kind === "link" ? "_blank" : undefined}
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <Download className="h-4 w-4" />
                  {material.kind === "file" ? `Download ${material.fileName || "file"}` : "Open link"}
                </a>
              </article>
            ))
          )}
        </div>
      )}

      {isStaff && (
        <div className="space-y-3">
          <h3 className="font-semibold">Sent materials</h3>
          {sent.length === 0 ? (
            <EmptyState title="Nothing sent yet" description="Materials you dispatch appear here." />
          ) : (
            sent.map((material) => (
              <article key={material.id} className={cn(panelClass, "p-4")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-medium">{material.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      <ProfileTrigger user={state.users.find((u) => u.id === material.sentById)}>
                        {material.sentByName}
                      </ProfileTrigger>{" "}
                      · {new Date(material.sentAt).toLocaleString()} ·{" "}
                      {material.recipientIds.length} recipient
                      {material.recipientIds.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{material.kind === "file" ? "File" : "Link"}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        deleteDispatchedMaterial(material.id);
                        toast.success("Material withdrawn.");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
