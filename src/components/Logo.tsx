/** The sun-star badge on its own (docs/BRAND.md, Logo). */
export function LogoMark({ size, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="18" fill="var(--leaf)" />
      <path d="M32 13l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L32 41.7 20.8 47.6l2.1-12.5-9.1-8.9 12.6-1.8Z" fill="var(--sun)" />
    </svg>
  );
}

/** Wordmark: a sun-star badge beside "Player One" in the display face (docs/BRAND.md, Logo). */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.4 }}>
      <LogoMark size={size * 1.3} />
      <span className="display" style={{ fontSize: size, lineHeight: 1 }}>
        Player One
      </span>
    </span>
  );
}
