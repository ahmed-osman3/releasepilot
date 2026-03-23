import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string, children: React.ReactNode }) {
    return (
        <section className={cn(`rounded-2xl border border-white/12 bg-[radial-gradient(120%_120%_at_50%_-30%,rgba(88,102,255,0.14),transparent_62%),linear-gradient(180deg,rgba(14,16,30,0.92),rgba(10,12,24,0.95))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_16px_40px_rgba(0,0,0,0.34)]`, className)}>
            {children}
        </section>
    )
}