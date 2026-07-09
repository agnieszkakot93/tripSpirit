import { MapPinIcon } from "@/components/icons";

type LoaderSize = "sm" | "md" | "lg";

const sizeMap: Record<LoaderSize, { ring: string; icon: string }> = {
  sm: { ring: "h-8 w-8", icon: "h-3.5 w-3.5" },
  md: { ring: "h-12 w-12", icon: "h-5 w-5" },
  lg: { ring: "h-16 w-16", icon: "h-6 w-6" },
};

type LoaderProps = {
  size?: LoaderSize;
  label?: string;
  className?: string;
};

export function Loader({ size = "md", label, className = "" }: LoaderProps) {
  const dims = sizeMap[size];

  return (
    <div
      className={`loader flex flex-col items-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={`loader-ring relative ${dims.ring}`}>
        <span className="loader-ring-track" aria-hidden />
        <span className="loader-ring-spin" aria-hidden />
        <span className="loader-ring-glow" aria-hidden />
        <span className="loader-ring-icon">
          <MapPinIcon className={`${dims.icon} text-[var(--primary)]`} />
        </span>
      </div>
      {label ? (
        <p className="loader-label text-sm font-semibold text-[var(--muted)]">
          {label}
        </p>
      ) : null}
      <span className="sr-only">{label ?? "Loading"}</span>
    </div>
  );
}

type LoaderPageProps = {
  label?: string;
  variant?: "light" | "dark";
  className?: string;
};

export function LoaderPage({
  label = "Loading…",
  variant = "light",
  className = "",
}: LoaderPageProps) {
  const isDark = variant === "dark";

  return (
    <div
      className={`flex h-full min-h-screen items-center justify-center p-12 ${
        isDark ? "bg-[var(--sidebar)]" : "bg-[var(--background)]"
      } ${className}`}
    >
      <div
        className={`flex flex-col items-center rounded-[32px] px-10 py-12 ${
          isDark
            ? "border border-white/10 bg-white/5"
            : "border border-[var(--border-muted)] bg-white shadow-[0_20px_60px_rgba(49,33,20,0.07)]"
        }`}
      >
        <Loader
          size="lg"
          label={label}
          className={isDark ? "[&_.loader-label]:text-white/70" : ""}
        />
      </div>
    </div>
  );
}

type LoaderInlineProps = {
  label?: string;
};

export function LoaderInline({ label }: LoaderInlineProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="loader-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      {label ? (
        <span className="text-sm font-semibold text-[var(--muted)]">{label}</span>
      ) : null}
    </span>
  );
}
