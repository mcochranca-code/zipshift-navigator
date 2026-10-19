import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type FieldLanguage = "en" | "es";
export type QueuedMutation = { id: string; kind: string; payload: unknown; createdAt: number };

type FieldOperationsContextValue = {
  privacyMode: boolean;
  setPrivacyMode: (enabled: boolean) => void;
  language: FieldLanguage;
  setLanguage: (language: FieldLanguage) => void;
  online: boolean;
  queue: QueuedMutation[];
  enqueue: (kind: string, payload: unknown) => void;
  flushQueue: () => void;
};

const STORAGE_KEY = "zipshift-field-queue";
const PrivacyContext = createContext<FieldOperationsContextValue | null>(null);

function readQueue(): QueuedMutation[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function FieldOperationsProvider({ children }: { children: ReactNode }) {
  const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem("zipshift-privacy-mode") === "true");
  const [language, setLanguage] = useState<FieldLanguage>(() => (localStorage.getItem("zipshift-language") as FieldLanguage) || "en");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [queue, setQueue] = useState<QueuedMutation[]>(readQueue);

  const persistQueue = useCallback((next: QueuedMutation[]) => {
    setQueue(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);
  const flushQueue = useCallback(() => { if (navigator.onLine) persistQueue([]); }, [persistQueue]);
  const enqueue = useCallback((kind: string, payload: unknown) => {
    if (navigator.onLine) return;
    persistQueue([...queue, { id: crypto.randomUUID(), kind, payload, createdAt: Date.now() }]);
  }, [persistQueue, queue]);

  useEffect(() => { localStorage.setItem("zipshift-privacy-mode", String(privacyMode)); }, [privacyMode]);
  useEffect(() => { localStorage.setItem("zipshift-language", language); window.dispatchEvent(new Event("zipshift-language-change")); }, [language]);
  useEffect(() => {
    const onOnline = () => { setOnline(true); flushQueue(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [flushQueue]);

  const value = useMemo(() => ({ privacyMode, setPrivacyMode, language, setLanguage, online, queue, enqueue, flushQueue }), [privacyMode, language, online, queue, enqueue, flushQueue]);
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function useFieldOperations() {
  const value = useContext(PrivacyContext);
  if (!value) throw new Error("useFieldOperations must be used within FieldOperationsProvider");
  return value;
}

export function displayName(name: string, privacyMode: boolean) {
  if (!privacyMode) return name;
  return name.split(/\s+/).filter(Boolean).map((part) => `${part[0]}.`).join("");
}
