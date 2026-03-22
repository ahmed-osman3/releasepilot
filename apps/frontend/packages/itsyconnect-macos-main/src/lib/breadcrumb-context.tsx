"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface BreadcrumbOverrides {
  /** Override the final breadcrumb segment label */
  title: string | null;
  setTitle: (title: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbOverrides | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);

  return (
    <BreadcrumbContext.Provider value={{ title, setTitle }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

/** Read the current breadcrumb title override (for the breadcrumb component). */
export function useBreadcrumbTitle(): string | null {
  const ctx = useContext(BreadcrumbContext);
  return ctx?.title ?? null;
}

/** Set a breadcrumb title from a page. Clears on unmount. */
export function useSetBreadcrumbTitle(title: string | null): void {
  const ctx = useContext(BreadcrumbContext);
  const setTitle = ctx?.setTitle;
  const titleRef = useRef(title);
  titleRef.current = title;

  // Update whenever title changes
  useEffect(() => {
    setTitle?.(titleRef.current);
  }, [setTitle, title]);

  // Clear on unmount
  useEffect(() => {
    return () => setTitle?.(null);
  }, [setTitle]);
}
