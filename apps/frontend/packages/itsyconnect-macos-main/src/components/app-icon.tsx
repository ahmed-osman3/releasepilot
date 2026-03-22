import { AppWindow } from "@phosphor-icons/react";

interface AppIconProps {
  iconUrl: string | null | undefined;
  name: string;
  /** Tailwind size class, e.g. "size-8" or "size-14". */
  className?: string;
  /** Phosphor icon size in px for the fallback. */
  iconSize?: number;
  /** Border-radius class. Defaults to "rounded-lg". */
  rounded?: string;
}

export function AppIcon({ iconUrl, name, className = "size-8", iconSize = 16, rounded = "rounded-lg" }: AppIconProps) {
  if (iconUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={iconUrl}
        alt={name}
        className={`${className} ${rounded} shadow-sm`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm ${rounded} ${className}`}
    >
      <AppWindow size={iconSize} weight="fill" />
    </div>
  );
}
