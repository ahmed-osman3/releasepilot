import { sortLocales, localeName } from "@/lib/asc/locale-names";
import { toast } from "sonner";

export function useLocaleHandlers<T>(options: {
  localeData: Record<string, T>;
  setLocaleData: React.Dispatch<React.SetStateAction<Record<string, T>>>;
  setLocales: (locales: string[]) => void;
  selectedLocale: string;
  changeLocale: (code: string) => void;
  primaryLocale: string;
  setDirty: (dirty: boolean) => void;
  emptyFields: () => T;
  undoOnDelete?: boolean;
}) {
  const {
    localeData,
    setLocaleData,
    setLocales,
    selectedLocale,
    changeLocale,
    primaryLocale,
    setDirty,
    emptyFields,
    undoOnDelete = true,
  } = options;

  function handleAddLocale(locale: string) {
    setLocaleData((prev) => {
      const base = prev[primaryLocale] ?? emptyFields();
      const next = { ...prev, [locale]: { ...base } };
      setLocales(sortLocales(Object.keys(next), primaryLocale));
      return next;
    });
    changeLocale(locale);
    setDirty(true);
    toast.success(`Added ${localeName(locale)}`);
  }

  function handleBulkAddLocales(codes: string[]) {
    setLocaleData((prev) => {
      const base = prev[primaryLocale] ?? emptyFields();
      const next = { ...prev };
      for (const code of codes) {
        if (!next[code]) next[code] = { ...base };
      }
      setLocales(sortLocales(Object.keys(next), primaryLocale));
      return next;
    });
    setDirty(true);
    toast.success(`Added ${codes.length} locales`);
  }

  function handleDeleteLocale(code: string) {
    const deletedData = localeData[code];
    const needsLocaleSwitch = selectedLocale === code;
    setLocaleData((prev) => {
      const next = { ...prev };
      delete next[code];
      setLocales(sortLocales(Object.keys(next), primaryLocale));
      return next;
    });
    if (needsLocaleSwitch) {
      const remaining = sortLocales(
        Object.keys(localeData).filter((c) => c !== code),
        primaryLocale,
      );
      changeLocale(remaining[0] ?? "");
    }
    setDirty(true);
    if (undoOnDelete) {
      toast(`Removed ${localeName(code)}`, {
        action: {
          label: "Undo",
          onClick: () => {
            setLocaleData((prev) => {
              const next = { ...prev, [code]: deletedData ?? emptyFields() };
              setLocales(sortLocales(Object.keys(next), primaryLocale));
              return next;
            });
            setDirty(true);
          },
        },
      });
    } else {
      toast(`Removed ${localeName(code)}`);
    }
  }

  return { handleAddLocale, handleBulkAddLocales, handleDeleteLocale };
}
