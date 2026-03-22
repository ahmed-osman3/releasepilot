"use client";

import Link from "next/link";
import {
  useParams,
  usePathname,
  useSearchParams,
} from "next/navigation";
import { cn } from "@/lib/utils";
import { AnalyticsProvider } from "@/lib/analytics-context";
import { AnalyticsRangePicker } from "@/components/analytics-range-picker";

const TABS = [
  { label: "Overview", segment: "" },
  { label: "Acquisition", segment: "/acquisition" },
  { label: "Usage", segment: "/usage" },
  { label: "Crashes", segment: "/crashes" },
  { label: "Performance", segment: "/performance" },
];

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { appId } = useParams<{ appId: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = `/dashboard/apps/${appId}/analytics`;
  const range = searchParams.get("range") || "30d";

  function buildHref(segment: string) {
    return `${base}${segment}${range !== "30d" ? `?range=${range}` : ""}`;
  }

  // Derive current segment so tab links preserve the range param
  const currentSegment =
    TABS.find((t) =>
      t.segment === ""
        ? pathname === base
        : pathname.startsWith(`${base}${t.segment}`),
    )?.segment ?? "";

  // Crashes = monthly aggregate, Performance = per-version – no range picker for either
  const showRangePicker = currentSegment !== "/crashes" && currentSegment !== "/performance";

  return (
    <AnalyticsProvider appId={appId}>
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex items-center justify-between border-b">
          <nav className="-mb-px flex">
            {TABS.map((tab) => {
              const href = buildHref(tab.segment);
              const active =
                tab.segment === ""
                  ? pathname === base
                  : pathname.startsWith(`${base}${tab.segment}`);
              return (
                <Link
                  key={tab.segment}
                  href={href}
                  className={cn(
                    "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          {showRangePicker && <AnalyticsRangePicker />}
        </div>
        {children}
      </div>
    </AnalyticsProvider>
  );
}
