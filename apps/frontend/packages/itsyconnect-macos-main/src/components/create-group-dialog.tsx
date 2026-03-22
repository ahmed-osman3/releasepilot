"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-fetch";

export function CreateGroupDialog({
  open,
  onOpenChange,
  appId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setIsInternal(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    try {
      await apiFetch(`/api/apps/${appId}/testflight/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), isInternal }),
      });
      toast.success(`Group "${name.trim()}" created`);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <RadioGroup
            value={isInternal ? "internal" : "external"}
            onValueChange={(v) => setIsInternal(v === "internal")}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="external" id="type-external" />
              <Label htmlFor="type-external">External</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="internal" id="type-internal" />
              <Label htmlFor="type-internal">Internal</Label>
            </div>
          </RadioGroup>
          <Input
            placeholder="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || submitting}>
              {submitting && <Spinner className="mr-1.5" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
