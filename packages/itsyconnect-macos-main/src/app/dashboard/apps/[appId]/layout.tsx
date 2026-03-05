import { Suspense } from "react";
import { SectionLocalesProvider } from "@/lib/section-locales-context";
import { SectionLocaleSeeder } from "@/components/section-locale-seeder";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SectionLocalesProvider>
      <Suspense>
        <SectionLocaleSeeder />
      </Suspense>
      {children}
    </SectionLocalesProvider>
  );
}
