import type { ComponentType, ReactNode } from "react";

interface EmptyStateProps {
  icon?: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: ReactNode;
}

/**
 * Vertically centred empty state for pages/sections with no data.
 * Must be rendered inside a flex column with flex-1 so it fills
 * the available space (the dashboard layout provides this by default).
 */
export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <Icon size={24} className="text-muted-foreground" />
        </div>
      )}
      <h2 className={`text-base font-medium${Icon ? " mt-4" : ""}`}>{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
