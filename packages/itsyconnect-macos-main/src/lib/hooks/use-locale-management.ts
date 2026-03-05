"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useSectionLocales,
  type SectionName,
} from "@/lib/section-locales-context";

interface UseLocaleManagementOptions {
  section: SectionName;
  primaryLocale: string;
}

export function useLocaleManagement({
  section,
  primaryLocale,
}: UseLocaleManagementOptions) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [locales, setLocales] = useState<string[]>([]);
  const [selectedLocale, setSelectedLocale] = useState(
    () => searchParams.get("locale") ?? "",
  );

  const changeLocale = useCallback(
    (code: string) => {
      setSelectedLocale(code);
      const next = new URLSearchParams(searchParams.toString());
      next.set("locale", code);
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  const { reportLocales, otherSectionLocales } = useSectionLocales(section);

  // Report locales to cross-section context
  useEffect(() => {
    reportLocales(locales);
  }, [locales, reportLocales]);

  return {
    locales,
    setLocales,
    selectedLocale,
    setSelectedLocale,
    changeLocale,
    otherSectionLocales,
  };
}
