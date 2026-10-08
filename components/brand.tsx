export function BrandMark({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#1f3f31" />
      <path d="M32 14 16 46h6l3.4-7h13.2l3.4 7h6L32 14Zm0 11.5L36.6 34h-9.2L32 25.5Z" fill="#f7f3ea" />
      <path d="M42 18c4-2 8-2 10 0-2 4-6 6-10 4 0-1 0-3 0-4Z" fill="#bf9a5e" />
    </svg>
  );
}

export function Wordmark({ name = "Auxois Intendance", tagline, light = false }: { name?: string; tagline?: string | null; light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark size={40} />
      <div className="leading-tight">
        <p className={`font-serif text-[20px] ${light ? "text-cream" : "text-forest-900"}`}>{name}</p>
        {tagline && <p className={`text-[12px] ${light ? "text-forest-200" : "text-ink-500"}`}>{tagline}</p>}
      </div>
    </div>
  );
}
