import React, { type CSSProperties } from "react";

/**
 * Branded loading + skeleton primitives. All motion is CSS-driven via the
 * `zs-*` classes in index.css and is disabled under prefers-reduced-motion
 * (skeletons stay as static placeholders, the splash mark stops pulsing).
 */

export function BrandedSplash({ tagline = "Navigate. Connect. Act.", status = "Loading ZipShift Navigator" }: { tagline?: string; status?: string }) {
  return (
    <div className="zs-splash" role="status" aria-live="polite" aria-busy="true">
      <span className="zs-sr-only">{status}</span>
      <div className="zs-splash-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="72" height="72" focusable="false">
          <circle className="zs-splash-ring" cx="32" cy="32" r="28" fill="none" strokeWidth="3" />
          <path className="zs-splash-route" d="M18 40 C24 22, 40 42, 46 24" fill="none" strokeWidth="4" strokeLinecap="round" />
          <circle className="zs-splash-pin zs-splash-pin--start" cx="18" cy="40" r="4.5" />
          <circle className="zs-splash-pin zs-splash-pin--end" cx="46" cy="24" r="4.5" />
        </svg>
      </div>
      <div className="zs-splash-word" aria-hidden="true">ZipShift</div>
      <p className="zs-splash-tagline" aria-hidden="true">{tagline}</p>
      <div className="zs-splash-progress" aria-hidden="true"><span /></div>
    </div>
  );
}

export function SkeletonBlock({ width = "100%", height = 14, radius, style, className = "" }: { width?: number | string; height?: number | string; radius?: number | string; style?: CSSProperties; className?: string }) {
  return <span aria-hidden="true" className={`zs-skeleton ${className}`.trim()} style={{ width, height, borderRadius: radius, ...style }} />;
}

/** A list of placeholder rows for data views. Announced once as "Loading …". */
export function SkeletonList({ rows = 4, label = "Loading", avatar = true, className = "" }: { rows?: number; label?: string; avatar?: boolean; className?: string }) {
  return (
    <div className={`zs-skeleton-list ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <span className="zs-sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="zs-skeleton-row" aria-hidden="true" style={{ animationDelay: `calc(var(--zs-stagger) * ${index})` }}>
          {avatar && <SkeletonBlock width={40} height={40} radius={10} />}
          <div className="zs-skeleton-lines">
            <SkeletonBlock width={`${78 - ((index * 13) % 30)}%`} height={13} />
            <SkeletonBlock width={`${52 - ((index * 7) % 20)}%`} height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grid of card-shaped placeholders (resource directories). */
export function SkeletonCards({ count = 6, label = "Loading", className = "" }: { count?: number; label?: string; className?: string }) {
  return (
    <div className={`zs-skeleton-cards ${className}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <span className="zs-sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="zs-skeleton-card" aria-hidden="true">
          <SkeletonBlock width="38%" height={10} />
          <SkeletonBlock width="82%" height={18} style={{ marginTop: 12 }} />
          <SkeletonBlock width="64%" height={12} style={{ marginTop: 10 }} />
          <SkeletonBlock width="48%" height={12} style={{ marginTop: 8 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <SkeletonBlock width={88} height={32} radius={8} />
            <SkeletonBlock width={88} height={32} radius={8} />
          </div>
        </div>
      ))}
    </div>
  );
}
