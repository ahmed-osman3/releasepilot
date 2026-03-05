"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { X } from "@phosphor-icons/react";

interface KeywordTagInputProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

function splitKeywords(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinKeywords(tags: string[]): string {
  return tags.join(",");
}

export function KeywordTagInput({
  value,
  onChange,
  readOnly,
}: KeywordTagInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = splitKeywords(value);

  const commitTags = useCallback(
    (raw: string) => {
      const newTags = splitKeywords(raw);
      if (newTags.length === 0) return;
      const merged = [...tags, ...newTags];
      onChange(joinKeywords(merged));
      setInput("");
    },
    [tags, onChange],
  );

  const removeTag = useCallback(
    (index: number) => {
      const next = tags.filter((_, i) => i !== index);
      onChange(joinKeywords(next));
    },
    [tags, onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
        if (input.trim()) {
          e.preventDefault();
          commitTags(input);
        } else if (e.key === ",") {
          e.preventDefault();
        }
      } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
        removeTag(tags.length - 1);
      }
    },
    [input, tags, commitTags, removeTag],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text");
      if (text.includes(",")) {
        e.preventDefault();
        commitTags(text);
      }
    },
    [commitTags],
  );

  const handleBlur = useCallback(() => {
    if (input.trim()) {
      commitTags(input);
    }
  }, [input, commitTags]);

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <Badge key={`${i}-${tag}`} variant="secondary" className="gap-1 py-0.5">
          {tag}
          {!readOnly && (
            <button
              type="button"
              className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
            >
              <X size={12} />
            </button>
          )}
        </Badge>
      ))}
      {!readOnly && (
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder={tags.length === 0 ? "Add keywords…" : ""}
          className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      )}
    </div>
  );
}
