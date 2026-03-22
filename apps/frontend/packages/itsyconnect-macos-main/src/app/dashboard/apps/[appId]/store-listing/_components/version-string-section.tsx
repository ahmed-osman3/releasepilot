import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, PencilSimple, X } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-fetch";
import {
  isValidVersionString,
  hasInvalidVersionChars,
  STATE_DOT_COLORS,
  stateLabel,
  type AscVersion,
} from "@/lib/asc/version-types";

export function VersionStringSection({
  appId,
  version,
  readOnly,
  onUpdated,
}: {
  appId: string;
  version?: AscVersion;
  readOnly: boolean;
  onUpdated: (newString: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(version?.attributes.versionString ?? "");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  const trimmed = draft.trim();
  const draftValid = trimmed !== "" && isValidVersionString(trimmed);

  async function save() {
    if (!draftValid || !version) return;
    if (trimmed === version.attributes.versionString) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/apps/${appId}/versions/${version.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionString: trimmed }),
      });
      onUpdated(trimmed);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update version");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="section-title">Version</h3>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-9 w-32 font-mono text-lg font-bold"
              autoFocus
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draftValid) { e.preventDefault(); save(); }
                if (e.key === "Escape") cancel();
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={save}
              disabled={saving || !draftValid}
            >
              {saving ? <Spinner className="size-3.5" /> : <Check size={14} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={cancel}
              disabled={saving}
            >
              <X size={14} />
            </Button>
            {trimmed !== "" && hasInvalidVersionChars(trimmed) && (
              <span className="text-xs text-destructive">Digits and dots only (e.g. 1.2.0)</span>
            )}
          </>
        ) : (
          <>
            <span className="font-mono text-2xl font-bold tracking-tight">
              {version?.attributes.versionString ?? "\u2013"}
            </span>
            {!readOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                onClick={startEdit}
              >
                <PencilSimple size={14} />
              </Button>
            )}
          </>
        )}
        {version && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span
              className={`size-1.5 shrink-0 rounded-full ${STATE_DOT_COLORS[version.attributes.appVersionState] ?? "bg-muted-foreground"}`}
            />
            {stateLabel(version.attributes.appVersionState)}
          </span>
        )}
      </div>
    </section>
  );
}
