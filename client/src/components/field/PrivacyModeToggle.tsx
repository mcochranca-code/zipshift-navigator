import { LockKeyhole } from "lucide-react";
import { useFieldOperations } from "./FieldOperationsContext";
export default function PrivacyModeToggle() { const { privacyMode, setPrivacyMode } = useFieldOperations(); return <button onClick={() => setPrivacyMode(!privacyMode)} aria-pressed={privacyMode} className={`rounded-xl px-3 py-2 text-xs font-black ${privacyMode ? "bg-[#159d92] text-white" : "bg-slate-100 text-slate-700"}`}><LockKeyhole size={14} className="mr-1 inline" />Privacy {privacyMode ? "on" : "off"}</button>; }
