import React from "react";

export type Crumb = { label: string; onSelect?: () => void };

/** Breadcrumb trail. The last crumb is the current page (aria-current="page"). */
export default function Breadcrumbs({ items, label = "Breadcrumb", style }: { items: Crumb[]; label?: string; style?: React.CSSProperties }) {
  if (items.length < 2) return null;
  return (
    <nav className="zs-breadcrumbs" aria-label={label} style={style}>
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              {last || !item.onSelect ? <span aria-current={last ? "page" : undefined}>{item.label}</span> : <button type="button" onClick={item.onSelect}>{item.label}</button>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
