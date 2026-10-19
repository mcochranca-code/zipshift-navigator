import { useEffect, useMemo, useState } from "react";
import { Accessibility, ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Headphones, House, Languages, MapPin, Search, ShieldCheck, Sparkles, Stethoscope, TrainFront, Utensils, Volume2 } from "lucide-react";

type GuidedProvider = {
  record_id: string;
  org_name: string;
  program_name: string;
  city: string;
  service_category: string;
  phone: string;
  website: string;
  address: string;
  hours: string;
  lat?: number;
  lng?: number;
};

type Need = { id: string; label: string; keywords: string[]; icon: typeof House };
const NEEDS: Need[] = [
  { id: "housing", label: "Somewhere to stay", keywords: ["shelter", "housing", "homeless", "mission"], icon: House },
  { id: "food", label: "Food or groceries", keywords: ["food", "meal", "pantry", "calfresh"], icon: Utensils },
  { id: "medical", label: "Medical care", keywords: ["medical", "health", "clinic", "hospital"], icon: Stethoscope },
  { id: "behavioral", label: "Mental health or substance use", keywords: ["behavioral", "mental", "substance", "sud", "crisis"], icon: ShieldCheck },
  { id: "transport", label: "A ride or transportation", keywords: ["transport", "transit", "ride"], icon: TrainFront },
  { id: "benefits", label: "Benefits, documents, or ID", keywords: ["benefit", "document", "medi-cal", "calfresh", "id"], icon: Search },
];

const URGENCY = ["Right now", "Today", "Within the next few days", "Planning ahead", "I'm not sure"];
const SUPPORTS = ["Spanish", "Larger text", "Fewer words", "Step-by-step instructions", "Audio / read aloud", "Wheelchair-accessible locations", "Transportation information"];

export default function GuidedAccess({ providers, language, onBack, onOpenProvider, onOpenDirectory, onFieldEvent }: { providers: GuidedProvider[]; language: "en" | "es"; onBack: () => void; onOpenProvider: (provider: GuidedProvider) => void; onOpenDirectory: () => void; onFieldEvent?: (eventType: "guided_start" | "guided_completion" | "guided_dropoff") => void }) {
  const es = language === "es";
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"guided" | "simple" | "search">("guided");
  const [needs, setNeeds] = useState<string[]>([]);
  const [urgency, setUrgency] = useState("");
  const [supports, setSupports] = useState<string[]>([]);
  const [unsure, setUnsure] = useState(false);

  useEffect(() => { onFieldEvent?.("guided_start"); }, []);
  useEffect(() => { if (step === 4) onFieldEvent?.("guided_completion"); }, [onFieldEvent, step]);

  const copy = es ? {
    eyebrow: "ACCESO GUIADO", title: "Te ayudamos a llegar al lugar correcto.", intro: "Te haré unas preguntas sencillas. Puedes saltar cualquier pregunta.", next: "Continuar", back: "Atrás", skip: "No estoy seguro / Saltar", results: "Tus opciones", matches: "opciones pueden coincidir", why: "Por qué mostramos esto", need: "¿Qué necesitas hoy?", urgency: "¿Qué tan pronto necesitas ayuda?", support: "¿Qué haría ZipShift más fácil?", mode: "¿Cómo quieres usar ZipShift?", guided: "Guíame paso a paso", simple: "Mantenerlo simple", search: "Déjame buscar", start: "Comenzar", directory: "Ver todo el directorio", reset: "Empezar de nuevo", open: "Abrir recurso", call: "Llamar", notSure: "No sé qué necesito", now: "Ayuda ahora", planning: "Estoy planeando", language: "Español priorizado", accessible: "Preferencias de acceso aplicadas", close: "Cerrar", noMatches: "No encontramos una coincidencia exacta. Prueba el directorio completo.",
  } : {
    eyebrow: "GUIDED ACCESS", title: "Let’s get you to the right place.", intro: "I’ll ask a few simple questions. You can skip any question.", next: "Continue", back: "Back", skip: "I’m not sure / Skip", results: "Your options", matches: "options may match", why: "Why we’re showing this", need: "What do you need help with today?", urgency: "How soon do you need help?", support: "What would make ZipShift easier?", mode: "How would you like to use ZipShift?", guided: "Walk me through it", simple: "Keep it simple", search: "Let me search myself", start: "Start", directory: "See full directory", reset: "Start over", open: "Open resource", call: "Call", notSure: "I don’t know what I need", now: "Help me now", planning: "I’m planning ahead", language: "Spanish prioritized", accessible: "Access preferences applied", close: "Close", noMatches: "No exact match found. Try the full directory.",
  };

  const selectedNeeds = NEEDS.filter((need) => needs.includes(need.id));
  const results = useMemo(() => {
    if (unsure || needs.length === 0) return providers.slice(0, 6);
    const scored = providers.map((provider) => {
      const text = `${provider.org_name} ${provider.program_name} ${provider.service_category}`.toLowerCase();
      const score = selectedNeeds.reduce((sum, need) => sum + (need.keywords.some((keyword) => text.includes(keyword)) ? 2 : 0), 0);
      return { provider, score };
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).map((item) => item.provider);
    return (scored.length ? scored : providers).slice(0, 6);
  }, [needs, providers, selectedNeeds, unsure]);

  const toggle = (value: string, setter: (values: string[]) => void, values: string[]) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const progress = step === 4 ? 100 : Math.round((step / 4) * 100);

  const exitGuidedAccess = () => { if (step < 4) onFieldEvent?.("guided_dropoff"); onBack(); };
  return <main className={`min-h-screen bg-[#f7f9fc] px-4 py-6 text-[#142846] sm:px-8 ${supports.includes("Larger text") ? "text-[18px]" : ""}`}>
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#159d92]">{copy.eyebrow}</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{copy.title}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{copy.intro}</p></div><button onClick={exitGuidedAccess} className="rounded-full border border-slate-200 bg-white p-2 text-slate-500" aria-label={copy.close}>×</button></header>
      <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#159d92] transition-all" style={{ width: `${progress}%` }} /></div>
      {step === 0 && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><Sparkles className="text-[#159d92]" size={28} /><h2 className="mt-4 text-2xl font-black">{copy.mode}</h2><div className="mt-5 grid gap-3">{[["guided", copy.guided, "One question at a time"], ["simple", copy.simple, "Big buttons and short steps"], ["search", copy.search, "Go directly to the existing resource search"]].map(([id, label, description]) => <button key={id} onClick={() => setMode(id as typeof mode)} className={`flex items-center justify-between rounded-2xl border p-4 text-left ${mode === id ? "border-[#159d92] bg-teal-50" : "border-slate-200"}`}><span><strong className="block text-base">{label}</strong><small className="text-slate-500">{description}</small></span>{mode === id && <Check className="text-[#159d92]" size={20} />}</button>)}</div><button onClick={() => mode === "search" ? onOpenDirectory() : setStep(1)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#159d92] px-5 py-4 font-black text-white">{copy.start}<ArrowRight size={18} /></button></section>}
      {step === 1 && <Question title={copy.need} subtitle="Choose anything that fits." icon={<CircleHelp size={26} className="text-[#159d92]" />}><div className="grid gap-3 sm:grid-cols-2">{NEEDS.map((need) => { const Icon = need.icon; const active = needs.includes(need.id); return <button key={need.id} onClick={() => toggle(need.id, setNeeds, needs)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left font-bold ${active ? "border-[#159d92] bg-teal-50 text-[#0f766e]" : "border-slate-200 bg-white"}`} aria-pressed={active}><Icon size={21} />{need.label}</button>; })}</div><button onClick={() => { setUnsure(true); setStep(2); }} className="mt-4 inline-flex items-center gap-2 rounded-xl text-sm font-bold text-[#0f766e]"><CircleHelp size={17} />{copy.notSure}</button></Question>}
      {step === 2 && <Question title={copy.urgency} subtitle="This helps us prioritize open-now and planning resources." icon={<ShieldCheck size={26} className="text-[#159d92]" />}><div className="grid gap-3">{URGENCY.map((item) => <button key={item} onClick={() => setUrgency(item)} className={`rounded-2xl border p-4 text-left font-bold ${urgency === item ? "border-[#159d92] bg-teal-50 text-[#0f766e]" : "border-slate-200"}`}>{item === "Right now" ? copy.now : item === "Planning ahead" ? copy.planning : item}</button>)}</div></Question>}
      {step === 3 && <Question title={copy.support} subtitle="Choose anything that would help. These preferences change presentation and ranking, not your identity." icon={<Accessibility size={26} className="text-[#159d92]" />}><div className="grid gap-3 sm:grid-cols-2">{SUPPORTS.map((item) => { const active = supports.includes(item); return <button key={item} onClick={() => toggle(item, setSupports, supports)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left font-bold ${active ? "border-[#159d92] bg-teal-50 text-[#0f766e]" : "border-slate-200"}`} aria-pressed={active}>{active ? <Check size={18} /> : <span className="h-[18px] w-[18px] rounded border border-slate-300" />}{item}</button>; })}</div></Question>}
      {step === 4 && <section><div className="mb-5 rounded-3xl bg-[#142846] p-6 text-white"><p className="text-xs font-black uppercase tracking-[.15em] text-teal-200">{copy.results}</p><h2 className="mt-2 text-2xl font-black">{selectedNeeds[0]?.label || copy.notSure}</h2><p className="mt-2 text-sm text-slate-300">{results.length} {copy.matches}</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">{urgency && <span className="rounded-full bg-white/10 px-3 py-1">{urgency}</span>}{supports.includes("Spanish") && <span className="rounded-full bg-white/10 px-3 py-1">{copy.language}</span>}{supports.some((item) => item.includes("access") || item.includes("transport")) && <span className="rounded-full bg-white/10 px-3 py-1">{copy.accessible}</span>}</div></div><div className="space-y-3">{results.map((provider) => <article key={provider.record_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{provider.org_name}</h3><p className="mt-1 text-sm text-slate-500">{provider.program_name || provider.service_category} · {provider.city}</p></div><MapPin className="shrink-0 text-[#159d92]" size={19} /></div><div className="mt-3 rounded-xl bg-teal-50 p-3 text-xs text-[#0f766e]"><strong className="flex items-center gap-1"><Check size={14} />{copy.why}</strong><span className="mt-1 block">{selectedNeeds.length ? "Matches your selected need" : "Available in the ZipShift resource collection"}{urgency === "Right now" ? " · Prioritized for immediate help" : ""}</span></div><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => onOpenProvider(provider)} className="inline-flex items-center gap-1 rounded-xl bg-[#159d92] px-3 py-2 text-xs font-black text-white">{copy.open}<ChevronRight size={14} /></button>{provider.phone && <a href={`tel:${provider.phone}`} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">{copy.call}</a>}</div></article>)}{!results.length && <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">{copy.noMatches}</p>}</div><div className="mt-5 flex flex-wrap justify-between gap-3"><button onClick={onOpenDirectory} className="inline-flex items-center gap-2 rounded-xl border border-[#b8d9d8] px-4 py-3 text-sm font-black text-[#0f766e]"><Search size={16} />{copy.directory}</button><button onClick={() => { setStep(0); setNeeds([]); setUrgency(""); setSupports([]); setUnsure(false); }} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600">{copy.reset}</button></div></section>}
      {step > 0 && step < 4 && <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><button onClick={() => setStep((value) => Math.max(0, value - 1))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600"><ArrowLeft size={16} />{copy.back}</button><button onClick={() => setStep((value) => Math.min(4, value + 1))} className="inline-flex items-center gap-2 rounded-xl bg-[#159d92] px-5 py-3 text-sm font-black text-white">{step === 3 ? copy.results : copy.next}<ArrowRight size={16} /></button><button onClick={() => setStep((value) => Math.min(4, value + 1))} className="rounded-xl px-3 py-3 text-sm font-bold text-[#0f766e]">{copy.skip}</button></div>}
    </div>
  </main>;
}

function Question({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"><div className="flex items-center gap-3">{icon}<div><h2 className="text-2xl font-black">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div></div><div className="mt-6">{children}</div></section>; }
