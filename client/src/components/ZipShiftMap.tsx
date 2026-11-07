import React, { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import L from "leaflet";
import { announce } from "../lib/a11y";
import { prefersReducedMotion } from "../lib/designTokens";

/**
 * Accessible community-resource map.
 *
 * - OpenStreetMap tiles (no API key) rendered with Leaflet.
 * - Lightweight grid clustering (no extra dependency) that re-groups on zoom.
 * - A synced, keyboard-navigable list is the accessible alternative to the map
 *   and the fallback when tiles cannot load (offline) or a resource has no
 *   coordinates. Selecting in either place highlights the other.
 * - PRIVACY: this component only ever receives public resource/location
 *   records (the provider directory). Never pass client, case, or referral
 *   data into it — nothing person-specific is placed on the map.
 */

export interface Provider {
  record_id: string;
  org_name: string;
  program_name: string;
  city: string;
  service_category: string;
  phone: string;
  website: string;
  address: string;
  hours: string;
  walk_in_allowed: string;
  referral_required: string;
  documents_required: string[];
  document_alternatives: string[];
  language_access: string;
  ada_access: string;
  pets_policy: string;
  partners_policy: string;
  capacity_status: string;
  waitlist_status: string;
  verification_status: string;
  verification_date: string;
  qr_record_id: string;
  transit_feasibility: string;
  service_node_cluster: string;
  referral_sources: string;
  hsai_score: number;
  lat: number;
  lng: number;
}

interface ZipShiftMapProps {
  providers: Provider[];
  selectedCity: string;
  onProviderSelect: (provider: Provider) => void;
  darkMode?: boolean;
  /** Show the synced list next to/below the map (default true). */
  showList?: boolean;
  /** Accessible name for the whole map region. */
  label?: string;
  /** Mouse-wheel zoom. Disable when the map sits inside a scrolling page. */
  scrollWheelZoom?: boolean;
}

// Category colors — all pass 4.5:1 against the white symbol text inside the pin.
export const CATEGORY_STYLES: Array<{ match: string; label: string; color: string; symbol: string }> = [
  { match: "housing", label: "Housing / Coordinated Entry", color: "#1a56db", symbol: "HO" },
  { match: "emergency shelter", label: "Emergency Shelter", color: "#b45309", symbol: "ES" },
  { match: "permanent supportive", label: "Permanent Supportive Housing", color: "#057a55", symbol: "PS" },
  { match: "rapid re-housing", label: "Rapid Re-Housing", color: "#7e3af2", symbol: "RR" },
  { match: "prevention", label: "Prevention & Diversion", color: "#c81e1e", symbol: "PD" },
  { match: "medical", label: "Medical / Behavioral Health", color: "#be185d", symbol: "MH" },
  { match: "benefits / food", label: "Benefits / Food Assistance", color: "#0e7490", symbol: "BA" },
  { match: "health insurance", label: "Health Insurance / Benefits", color: "#4b5563", symbol: "HI" },
];
const FALLBACK_STYLE = { label: "Other resource", color: "#374151", symbol: "RS" };

export function getCategoryStyle(category: string | undefined) {
  const value = (category || "").toLowerCase();
  // Most specific matches first so "Permanent Supportive Housing" is not caught by "housing".
  const ordered = [...CATEGORY_STYLES].sort((a, b) => b.match.length - a.match.length);
  return ordered.find((style) => value.includes(style.match)) || FALLBACK_STYLE;
}

export function hasCoordinates(provider: Pick<Provider, "lat" | "lng">) {
  return Number.isFinite(provider.lat) && Number.isFinite(provider.lng) && provider.lat !== 0 && provider.lng !== 0 && Math.abs(provider.lat) <= 90 && Math.abs(provider.lng) <= 180;
}

const CITY_CENTERS: Record<string, [number, number]> = {
  all: [37.58, -120.94],
  modesto: [37.6393, -120.9969],
  turlock: [37.4969, -120.8459],
  ceres: [37.5947, -120.9577],
};
const CITY_ZOOM: Record<string, number> = { all: 10, modesto: 13, turlock: 13, ceres: 13 };
const CLUSTER_CELL_PX = 56;
const CLUSTER_UNTIL_ZOOM = 15;
const TILE_ERROR_THRESHOLD = 4;

type Cluster = { key: string; members: Provider[]; center: L.LatLng };

export function clusterProviders(map: L.Map, providers: Provider[]): Cluster[] {
  const zoom = map.getZoom();
  if (zoom > CLUSTER_UNTIL_ZOOM) return providers.map((provider) => ({ key: provider.record_id, members: [provider], center: L.latLng(provider.lat, provider.lng) }));
  const buckets = new Map<string, Provider[]>();
  for (const provider of providers) {
    const point = map.project([provider.lat, provider.lng], zoom);
    const key = `${Math.floor(point.x / CLUSTER_CELL_PX)}:${Math.floor(point.y / CLUSTER_CELL_PX)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(provider);
    else buckets.set(key, [provider]);
  }
  return Array.from(buckets, ([key, members]) => {
    const lat = members.reduce((sum, member) => sum + member.lat, 0) / members.length;
    const lng = members.reduce((sum, member) => sum + member.lng, 0) / members.length;
    return { key: members.length === 1 ? members[0].record_id : `cluster-${key}`, members, center: L.latLng(lat, lng) };
  });
}

export default function ZipShiftMap({ providers, selectedCity, onProviderSelect, darkMode, showList = true, label = "Community resource map", scrollWheelZoom = true }: ZipShiftMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markerById = useRef(new Map<string, L.Marker>());
  const listItemRefs = useRef(new Map<string, HTMLButtonElement>());
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const [mapFailed, setMapFailed] = useState(false);
  const [viewVersion, setViewVersion] = useState(0);
  const listId = useMemo(() => `zs-map-list-${Math.random().toString(36).slice(2, 8)}`, []);

  const mappable = useMemo(() => providers.filter(hasCoordinates), [providers]);
  const unmappedCount = providers.length - mappable.length;
  const active = useMemo(() => providers.find((provider) => provider.record_id === activeId) || null, [providers, activeId]);

  // Keep the active selection valid when filters change.
  useEffect(() => {
    if (activeId && !providers.some((provider) => provider.record_id === activeId)) {
      setActiveId(null);
      setPreviewOpen(false);
    }
  }, [providers, activeId]);

  useEffect(() => {
    const goOnline = () => { setOnline(true); setTilesUnavailable(false); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Initialize map once.
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const reduced = prefersReducedMotion();
    let map: L.Map;
    try {
      map = L.map(mapRef.current, {
        center: CITY_CENTERS.all,
        zoom: CITY_ZOOM.all,
        zoomControl: true,
        scrollWheelZoom,
        keyboard: true,
        zoomAnimation: !reduced,
        fadeAnimation: !reduced,
        markerZoomAnimation: !reduced,
      });
    } catch {
      setMapFailed(true);
      return;
    }

    let tileErrors = 0;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    })
      .on("tileerror", () => {
        tileErrors += 1;
        if (tileErrors >= TILE_ERROR_THRESHOLD) setTilesUnavailable(true);
      })
      .on("tileload", () => {
        tileErrors = 0;
        setTilesUnavailable(false);
      })
      .addTo(map);

    // City service-area outlines (decorative, non-interactive, not tab stops).
    [
      { center: CITY_CENTERS.modesto, name: "Modesto", color: "#1a56db" },
      { center: CITY_CENTERS.turlock, name: "Turlock", color: "#057a55" },
      { center: CITY_CENTERS.ceres, name: "Ceres", color: "#b45309" },
    ].forEach(({ center, name, color }) => {
      L.circle(center, { radius: 2000, color, fillColor: color, fillOpacity: 0.05, weight: 2, dashArray: "6 4", interactive: false }).addTo(map);
      L.marker(center, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: "", html: `<div aria-hidden="true" style="background:${color};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3)">${name}</div>`, iconAnchor: [30, 10] }),
      }).addTo(map);
    });

    // Describe the keyboard model on Leaflet's own focusable container.
    const container = map.getContainer();
    container.setAttribute("aria-roledescription", "map");
    container.setAttribute("aria-label", `${label}. Use arrow keys to pan and plus or minus to zoom. Resource pins can be reached with Tab; the list offers the same resources.`);

    layerRef.current = L.layerGroup().addTo(map);
    map.on("zoomend moveend", () => setViewVersion((value) => value + 1));
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerRef.current = null;
      markerById.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once
  }, []);

  const selectProvider = useCallback((provider: Provider, origin: "map" | "list") => {
    setActiveId(provider.record_id);
    setPreviewOpen(true);
    announce(`${provider.org_name} selected. ${provider.address || provider.city}.`);
    const map = mapInstanceRef.current;
    if (origin === "list" && map && hasCoordinates(provider)) {
      const target = L.latLng(provider.lat, provider.lng);
      const zoom = Math.max(map.getZoom(), CLUSTER_UNTIL_ZOOM + 1);
      map.setView(target, zoom, { animate: !prefersReducedMotion() });
    }
    if (origin === "map") {
      listItemRefs.current.get(provider.record_id)?.scrollIntoView?.({ block: "nearest" });
      window.setTimeout(() => previewHeadingRef.current?.focus(), 0);
    }
  }, []);

  // (Re)draw markers + clusters whenever data, view, or selection changes.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markerById.current.clear();

    for (const cluster of clusterProviders(map, mappable)) {
      if (cluster.members.length === 1) {
        const provider = cluster.members[0];
        const style = getCategoryStyle(provider.service_category);
        const isActive = provider.record_id === activeId;
        const verified = provider.verification_status === "verified";
        const marker = L.marker(cluster.center, {
          keyboard: true,
          title: provider.org_name,
          riseOnHover: true,
          zIndexOffset: isActive ? 1000 : 0,
          icon: L.divIcon({
            className: "",
            iconSize: [34, 34],
            iconAnchor: [17, 34],
            html: `<div class="zs-map-marker${isActive ? " is-active" : ""}" style="background:${style.color}"><span aria-hidden="true">${style.symbol}</span></div>${verified ? '<span aria-hidden="true" style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;background:#047857;border-radius:50%;border:2px solid #fff"></span>' : ""}`,
          }),
        });
        marker.on("click", () => selectProvider(provider, "map"));
        marker.addTo(layer);
        const element = marker.getElement();
        if (element) {
          element.setAttribute("role", "button");
          element.setAttribute("aria-label", `${provider.org_name}, ${style.label}${verified ? ", verified" : ""}. ${provider.city}.`);
          if (isActive) element.setAttribute("aria-pressed", "true");
        }
        markerById.current.set(provider.record_id, marker);
      } else {
        const count = cluster.members.length;
        const marker = L.marker(cluster.center, {
          keyboard: true,
          title: `${count} resources`,
          icon: L.divIcon({ className: "", iconSize: [42, 42], iconAnchor: [21, 21], html: `<div class="zs-map-cluster"><span aria-hidden="true">${count}</span></div>` }),
        });
        marker.on("click", () => {
          const bounds = L.latLngBounds(cluster.members.map((member) => [member.lat, member.lng] as [number, number]));
          map.fitBounds(bounds.pad(0.4), { animate: !prefersReducedMotion(), maxZoom: CLUSTER_UNTIL_ZOOM + 1 });
          announce(`Zoomed in to ${count} resources: ${cluster.members.slice(0, 3).map((member) => member.org_name).join(", ")}${count > 3 ? " and more" : ""}.`);
        });
        marker.addTo(layer);
        const element = marker.getElement();
        if (element) {
          element.setAttribute("role", "button");
          element.setAttribute("aria-label", `${count} resources grouped here, including ${cluster.members[0].org_name}. Activate to zoom in.`);
        }
      }
    }
  }, [mappable, activeId, viewVersion, selectProvider]);

  // Fly to the selected city filter.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const cityKey = selectedCity.toLowerCase();
    if (!CITY_CENTERS[cityKey]) return;
    if (prefersReducedMotion()) map.setView(CITY_CENTERS[cityKey], CITY_ZOOM[cityKey], { animate: false });
    else map.flyTo(CITY_CENTERS[cityKey], CITY_ZOOM[cityKey], { duration: 0.8 });
  }, [selectedCity]);

  const closePreview = () => {
    setPreviewOpen(false);
    const id = activeId;
    if (id) window.setTimeout(() => listItemRefs.current.get(id)?.focus(), 0);
  };

  // Roving arrow-key navigation inside the list.
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(listItemRefs.current.values()).filter((button) => document.contains(button));
    buttons.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = index;
    if (event.key === "ArrowDown") next = Math.min(buttons.length - 1, index + 1);
    if (event.key === "ArrowUp") next = Math.max(0, index - 1);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = buttons.length - 1;
    if (next !== index && buttons[next]) {
      event.preventDefault();
      buttons[next].focus();
    }
  };

  const showTileNotice = !online || tilesUnavailable || mapFailed;
  const subtle = darkMode ? "#9ca3af" : "#64748b";

  return (
    <section className="zs-map" aria-label={label} data-zs-theme={darkMode ? "dark" : undefined}>
      <div className="zs-map-canvas-wrap">
        <div ref={mapRef} className="zs-map-canvas" />

        <div className="zs-map-overlay zs-map-count" aria-hidden="true">
          {mappable.length} on map{unmappedCount > 0 ? ` · ${unmappedCount} list only` : ""}
        </div>

        <div className="zs-map-overlay zs-map-legend">
          <strong id={`${listId}-legend`} style={{ fontSize: 12 }}>Resource types</strong>
          <ul aria-labelledby={`${listId}-legend`}>
            {CATEGORY_STYLES.slice(0, 6).map((style) => (
              <li key={style.match}>
                <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: 20, height: 20, borderRadius: "50%", background: style.color, color: "#fff", fontSize: 8, fontWeight: 900 }}>{style.symbol}</span>
                <span>{style.label}</span>
              </li>
            ))}
            <li>
              <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: "50%", background: "#047857", border: "2px solid #fff", boxShadow: "0 0 0 1px #047857" }} />
              <span>ZipShift verified</span>
            </li>
          </ul>
        </div>

        {active && previewOpen && (
          <section className="zs-map-overlay zs-map-preview" aria-labelledby={`${listId}-preview-title`}>
            <div style={{ background: getCategoryStyle(active.service_category).color, color: "#fff", padding: "10px 14px", display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{active.service_category.split("/")[0].trim()}</p>
                <h3 id={`${listId}-preview-title`} ref={previewHeadingRef} tabIndex={-1} style={{ margin: "2px 0 0", fontSize: 14, lineHeight: 1.3 }}>{active.org_name}</h3>
              </div>
              <button type="button" className="zs-icon-button" onClick={closePreview} aria-label={`Close details for ${active.org_name}`} style={{ minWidth: 32, minHeight: 32, color: "#fff", background: "rgb(255 255 255 / 18%)", borderRadius: "50%" }}>
                <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>×</span>
              </button>
            </div>
            <div style={{ padding: "12px 14px", fontSize: 12 }}>
              {active.program_name && <p style={{ margin: "0 0 6px", color: subtle }}>{active.program_name}</p>}
              <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 8px" }}>
                <dt style={{ fontWeight: 800, color: "var(--zs-color-brand-strong)" }}>Address</dt>
                <dd style={{ margin: 0 }}>{active.address || `${active.city} (address on request)`}</dd>
                {active.hours && <><dt style={{ fontWeight: 800, color: "var(--zs-color-brand-strong)" }}>Hours</dt><dd style={{ margin: 0 }}>{active.hours}</dd></>}
                {active.phone && <><dt style={{ fontWeight: 800, color: "var(--zs-color-brand-strong)" }}>Phone</dt><dd style={{ margin: 0 }}><a href={`tel:${active.phone}`} style={{ color: "#1a56db", fontWeight: 700 }}>{active.phone}</a></dd></>}
              </dl>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                <button type="button" className="zs-press" onClick={() => { onProviderSelect(active); setPreviewOpen(false); }} style={{ flex: 1, minHeight: 40, border: 0, borderRadius: 8, background: "var(--zs-color-navy)", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
                  Full profile <span aria-hidden="true">→</span>
                </button>
                {active.phone && <a className="zs-press" href={`tel:${active.phone}`} aria-label={`Call ${active.org_name}`} style={{ display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 14px", borderRadius: 8, background: "#047857", color: "#fff", fontWeight: 800, textDecoration: "none" }}>Call</a>}
              </div>
            </div>
          </section>
        )}
      </div>

      {showList && (
        <div className="zs-map-panel">
          <div className="zs-map-panel-head">
            <h2 id={`${listId}-title`}>Resources in view ({providers.length})</h2>
          </div>
          {showTileNotice && (
            <p className="zs-map-notice" role="status">
              {mapFailed ? "The interactive map could not start on this device." : !online ? "You appear to be offline, so map tiles can’t load." : "Map tiles aren’t loading right now."} Every resource is still listed below.
            </p>
          )}
          {unmappedCount > 0 && (
            <p className="zs-map-notice" style={{ background: "var(--zs-color-surface-muted)", color: "var(--zs-color-text-muted)" }}>
              {unmappedCount} {unmappedCount === 1 ? "resource has" : "resources have"} no map location yet and {unmappedCount === 1 ? "appears" : "appear"} only in this list.
            </p>
          )}
          {providers.length === 0 ? (
            <p style={{ padding: 16, margin: 0, color: subtle, fontSize: 13 }}>No resources match the current filters.</p>
          ) : (
            <ul className="zs-map-list" id={listId} aria-labelledby={`${listId}-title`} onKeyDown={onListKeyDown}>
              {providers.map((provider) => {
                const style = getCategoryStyle(provider.service_category);
                const isActive = provider.record_id === activeId;
                const mapped = hasCoordinates(provider);
                return (
                  <li key={provider.record_id}>
                    <button
                      type="button"
                      className="zs-map-item"
                      aria-current={isActive ? "true" : undefined}
                      ref={(element) => {
                        if (element) listItemRefs.current.set(provider.record_id, element);
                        else listItemRefs.current.delete(provider.record_id);
                      }}
                      onClick={() => selectProvider(provider, "list")}
                    >
                      <span className="zs-map-item-dot" aria-hidden="true" style={{ background: style.color }}>{style.symbol}</span>
                      <span style={{ minWidth: 0 }}>
                        <strong>{provider.org_name}</strong>
                        <small>{style.label} · {provider.city}{mapped ? "" : " · no map location"}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
