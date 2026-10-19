import { Wifi, WifiOff } from "lucide-react";
import { useFieldOperations } from "./FieldOperationsContext";
export default function OfflineIndicator() { const { online, queue } = useFieldOperations(); if (online) return null; return <div className="fixed bottom-[5.5rem] left-1/2 z-[79] -translate-x-1/2 rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-900 shadow-lg"><WifiOff size={14} className="mr-1 inline" />Offline · {queue.length} queued</div>; }
export function OnlineStatus() { const { online } = useFieldOperations(); return online ? <Wifi size={14} className="text-emerald-500" /> : <WifiOff size={14} className="text-amber-500" />; }
