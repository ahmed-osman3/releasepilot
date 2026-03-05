export function CharCount({ value, limit, min }: { value: string; limit?: number; min?: number }) {
  const count = value?.length ?? 0;
  if (!limit) return null;
  const over = count > limit;
  const under = min != null && count > 0 && count < min;

  return (
    <span
      className={`mt-[3px] text-xs tabular-nums ${over || under ? "font-medium text-destructive" : "text-muted-foreground"}`}
    >
      {count}/{limit}
    </span>
  );
}
