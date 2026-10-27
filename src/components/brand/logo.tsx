import { cn } from "@/lib/utils";

/**
 * Símbolo do Grifo: linhas de texto com uma delas grifada.
 * Em tamanhos pequenos (compact) mostra só o grifo central.
 */
function LogoMark({
  size = 32,
  className,
  compact = false,
  inverted = false,
}: {
  size?: number;
  className?: string;
  compact?: boolean;
  inverted?: boolean;
}) {
  const tile = inverted ? "#FFFFFF" : "#2453E6";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={cn("shrink-0", className)}>
      <rect width="40" height="40" rx="11" fill={tile} />
      {compact ? null : <rect x="10" y="10" width="20" height="3.4" rx="1.7" fill="#A9BEFF" />}
      <rect x="7.5" y="16.5" width="25" height="8" rx="2.6" fill="#FFD84D" transform="rotate(-4 20 20.5)" />
      <rect x="10" y="19.3" width="16" height="2.8" rx="1.4" fill="#0E1B33" />
      {compact ? null : <rect x="10" y="28" width="13" height="3.4" rx="1.7" fill="#A9BEFF" />}
    </svg>
  );
}

function Logo({
  className,
  size = 32,
  inverted = false,
  wordmarkClassName,
}: {
  className?: string;
  size?: number;
  inverted?: boolean;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} inverted={inverted} />
      <span
        className={cn(
          "font-display text-[1.6rem] leading-none font-extrabold tracking-[-0.03em]",
          inverted ? "text-white" : "text-foreground",
          wordmarkClassName,
        )}
      >
        grifo
      </span>
    </span>
  );
}

export { Logo, LogoMark };
