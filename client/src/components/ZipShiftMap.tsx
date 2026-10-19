import { useEffect, useRef, useState } from "react";
import L from "leaflet";

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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
}

// Service category color mapping
const CATEGORY_COLORS: Record<string, string> = {
  "Housing / Coordinated Entry": "#1a56db",
  "Emergency Shelter": "#e3a008",
  "Permanent Supportive Housing (PSH)": "#057a55",
  "Rapid Re-Housing (RRH)": "#7e3af2",
  "Prevention & Diversion": "#e02424",
  "Medical/Behavioral Health": "#d61f69",
  "Benefits / Food Assistance": "#0694a2",
  "Health Insurance / Benefits": "#6b7280",
};

const CATEGORY_SYMBOLS: Record<string, string> = {
  "Housing / Coordinated Entry": "HO",
  "Emergency Shelter": "ES",
  "Permanent Supportive Housing (PSH)": "PS",
  "Rapid Re-Housing (RRH)": "RR",
  "Prevention & Diversion": "PD",
  "Medical/Behavioral Health": "MH",
  "Benefits / Food Assistance": "BA",
  "Health Insurance / Benefits": "HI",
};

function getCategoryColor(category: string | undefined): string {
  if (!category) return "#374151";
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (category.toLowerCase().includes(key.toLowerCase().split("/")[0].trim().toLowerCase())) {
      return color;
    }
  }
  return "#374151";
}

function getCategorySymbol(category: string | undefined): string {
  if (!category) return "RS";
  for (const [key, sym] of Object.entries(CATEGORY_SYMBOLS)) {
    if (category.toLowerCase().includes(key.toLowerCase().split("/")[0].trim().toLowerCase())) {
      return sym;
    }
  }
  return "RS";
}

function createCustomIcon(category: string, verified: boolean): L.DivIcon {
  const color = getCategoryColor(category);
  const symbol = getCategorySymbol(category);
  const verifiedBadge = verified ? `<div style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;background:#10b981;border-radius:50%;border:2px solid white;"></div>` : "";
  
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:36px;height:36px;">
        <div style="
          width:36px;height:36px;
          background:${color};
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
        ">
          <span style="transform:rotate(45deg);font-size:14px;line-height:1;">${symbol}</span>
        </div>
        ${verifiedBadge}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

// City center coordinates
const CITY_CENTERS: Record<string, [number, number]> = {
  all: [37.5800, -120.9400],
  modesto: [37.6393, -120.9969],
  turlock: [37.4969, -120.8459],
  ceres: [37.5947, -120.9577],
};

const CITY_ZOOM: Record<string, number> = {
  all: 10,
  modesto: 13,
  turlock: 13,
  ceres: 13,
};

export default function ZipShiftMap({ providers, selectedCity, onProviderSelect, darkMode }: ZipShiftMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [previewProvider, setPreviewProvider] = useState<Provider | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: CITY_CENTERS.all,
      zoom: CITY_ZOOM.all,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // Topographic tile layer (OpenTopoMap - free, no API key)
    L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      maxZoom: 17,
    }).addTo(map);

    // Add city boundary circles
    const cityCircles = [
      { center: [37.6393, -120.9969] as [number, number], label: "Modesto", color: "#1a56db" },
      { center: [37.4969, -120.8459] as [number, number], label: "Turlock", color: "#057a55" },
      { center: [37.5947, -120.9577] as [number, number], label: "Ceres", color: "#e3a008" },
    ];

    cityCircles.forEach(({ center, label, color }) => {
      L.circle(center, {
        radius: 2000,
        color: color,
        fillColor: color,
        fillOpacity: 0.05,
        weight: 2,
        dashArray: "6 4",
      }).addTo(map);

      L.marker(center, {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:${color};color:white;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${label}</div>`,
          iconAnchor: [30, 10],
        }),
      }).addTo(map);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when providers or city changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add new markers
    providers.forEach(provider => {
      if (!provider.lat || !provider.lng) return;

      const icon = createCustomIcon(
        provider.service_category,
        provider.verification_status === "verified"
      );

      const marker = L.marker([provider.lat, provider.lng], { icon })
        .addTo(map)
        .on("click", () => {
          setPreviewProvider(provider);
        });

      markersRef.current.push(marker);
    });

    // Fly to selected city
    const cityKey = selectedCity.toLowerCase();
    if (CITY_CENTERS[cityKey]) {
      map.flyTo(CITY_CENTERS[cityKey], CITY_ZOOM[cityKey], { duration: 1.2 });
    }
  }, [providers, selectedCity]);

  const hsaiColor = (score: number) => {
    if (score >= 4.5) return "#10b981";
    if (score >= 3.5) return "#f59e0b";
    if (score >= 2.5) return "#ef4444";
    return "#6b7280";
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Map container */}
      <div ref={mapRef} style={{ width: "100%", height: "100%", borderRadius: "0 0 12px 12px" }} />

      {/* Legend */}
      <div style={{
        position: "absolute",
        bottom: 24,
        left: 12,
        background: darkMode ? "rgba(17,24,39,0.95)" : "rgba(255,255,255,0.97)",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        zIndex: 1000,
        minWidth: 160,
        fontSize: 11,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: darkMode ? "#f9fafb" : "#111827", fontSize: 12 }}>
          Resource Types
        </div>
        {Object.entries(CATEGORY_COLORS).slice(0, 6).map(([cat, color]) => (
          <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ color: darkMode ? "#d1d5db" : "#374151", fontSize: 10 }}>
              {cat.split("/")[0].trim().split(" ").slice(0, 2).join(" ")}
            </span>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${darkMode ? "#374151" : "#e5e7eb"}`, marginTop: 6, paddingTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
            <span style={{ color: darkMode ? "#d1d5db" : "#374151", fontSize: 10 }}>ZipShift Verified</span>
          </div>
        </div>
      </div>

      {/* Provider count badge */}
      <div style={{
        position: "absolute",
        top: 12,
        right: 12,
        background: "#1a56db",
        color: "white",
        borderRadius: 20,
        padding: "4px 12px",
        fontSize: 12,
        fontWeight: 700,
        zIndex: 1000,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}>
        {providers.length} Verified Resources
      </div>

      {/* Preview card */}
      {previewProvider && (
        <div style={{
          position: "absolute",
          bottom: 24,
          right: 12,
          width: 280,
          background: darkMode ? "#1f2937" : "white",
          borderRadius: 12,
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          zIndex: 1001,
          overflow: "hidden",
          border: `2px solid ${getCategoryColor(previewProvider.service_category)}`,
        }}>
          {/* Card header */}
          <div style={{
            background: getCategoryColor(previewProvider.service_category),
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {previewProvider.service_category.split("/")[0].trim()}
              </div>
              <div style={{ fontSize: 13, color: "white", fontWeight: 700, lineHeight: 1.3, marginTop: 2 }}>
                {previewProvider.org_name}
              </div>
            </div>
            <button
              onClick={() => setPreviewProvider(null)}
              style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >×</button>
          </div>

          {/* Card body */}
          <div style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: darkMode ? "#9ca3af" : "#6b7280", marginBottom: 6 }}>
              {previewProvider.program_name}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "#0f766e", letterSpacing: 0.4 }}>ADDR</span>
              <span style={{ fontSize: 11, color: darkMode ? "#d1d5db" : "#374151" }}>{previewProvider.address}</span>
            </div>

            {previewProvider.phone && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: "#0f766e", letterSpacing: 0.4 }}>TEL</span>
                <a href={`tel:${previewProvider.phone}`} style={{ fontSize: 11, color: "#1a56db", textDecoration: "none", fontWeight: 600 }}>
                  {previewProvider.phone}
                </a>
              </div>
            )}

            {/* HSAI Score */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: darkMode ? "#9ca3af" : "#6b7280" }}>HSAI Score</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 60,
                  height: 6,
                  background: darkMode ? "#374151" : "#e5e7eb",
                  borderRadius: 3,
                  overflow: "hidden",
                }}>
                  <div style={{
                    width: `${(previewProvider.hsai_score / 5) * 100}%`,
                    height: "100%",
                    background: hsaiColor(previewProvider.hsai_score),
                    borderRadius: 3,
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: hsaiColor(previewProvider.hsai_score) }}>
                  {previewProvider.hsai_score.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Verification badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
              <span style={{ fontSize: 10, background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span aria-hidden="true" style={{ width: 14, height: 14, display: "grid", placeItems: "center", borderRadius: "50%", background: "#0f766e", color: "#fff", fontSize: 10, fontWeight: 800 }}>V</span> ZipShift Verified</span>
              </span>
              <span style={{ fontSize: 10, color: darkMode ? "#9ca3af" : "#6b7280" }}>{previewProvider.city}</span>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => { onProviderSelect(previewProvider); setPreviewProvider(null); }}
                style={{
                  flex: 1,
                  background: getCategoryColor(previewProvider.service_category),
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 0",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Full Profile →
              </button>
              {previewProvider.phone && (
                <a
                  href={`tel:${previewProvider.phone}`}
                  style={{
                    background: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "7px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  Call
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
