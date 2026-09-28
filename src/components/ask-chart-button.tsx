import { cn } from "@/lib/utils";

export function AskChartMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M7.2 5.2h13.4c2.5 0 4.5 2 4.5 4.5v7.2c0 2.5-2 4.5-4.5 4.5h-5.2l-4.4 4.1c-.55.5-1.4.1-1.4-.6v-3.5H7.2c-2.5 0-4.5-2-4.5-4.5V9.7c0-2.5 2-4.5 4.5-4.5Z"
      />
      <path
        fill="var(--ask-mark-ink, #f4f0e6)"
        d="M9.1 16.7h2.15v-3.15H9.1v3.15Zm3.35 0h2.15V10.2h-2.15v6.5Zm3.35 0H18V12h-2.2v4.7Z"
      />
    </svg>
  );
}

export function AskChartButton({
  onClick,
  label = "Ask about this",
  className,
  pressed = false,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
        className,
      )}
    >
      <AskChartMark className="size-6" />
    </button>
  );
}
