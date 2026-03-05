"use client";

import { createContext, useContext, useCallback, useState } from "react";
import {
  ErrorReportDialog,
  type AscErrorReportData,
  type SyncErrorReportData,
} from "@/components/error-report-dialog";
import type { SyncError } from "@/lib/api-helpers";

type ReportData =
  | ({ kind: "asc" } & AscErrorReportData)
  | ({ kind: "sync" } & SyncErrorReportData)
  | null;

interface ErrorReportContextValue {
  showAscError: (data: AscErrorReportData) => void;
  showSyncErrors: (syncErrors: SyncError[]) => void;
}

const ErrorReportContext = createContext<ErrorReportContextValue | null>(null);

export function ErrorReportProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<ReportData>(null);

  const showAscError = useCallback((d: AscErrorReportData) => {
    setData({ kind: "asc", ...d });
  }, []);

  const showSyncErrors = useCallback((syncErrors: SyncError[]) => {
    setData({ kind: "sync", syncErrors });
  }, []);

  return (
    <ErrorReportContext.Provider value={{ showAscError, showSyncErrors }}>
      {children}
      <ErrorReportDialog data={data} onClose={() => setData(null)} />
    </ErrorReportContext.Provider>
  );
}

export function useErrorReport(): ErrorReportContextValue {
  const ctx = useContext(ErrorReportContext);
  if (!ctx) throw new Error("useErrorReport must be used within ErrorReportProvider");
  return ctx;
}
