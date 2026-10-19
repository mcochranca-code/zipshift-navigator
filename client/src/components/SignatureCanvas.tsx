import React, { useEffect, useRef, useState } from "react";

export default function SignatureCanvas({ onChange }: { onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = 720 * ratio;
    canvas.height = 220 * ratio;
    const context = canvas.getContext("2d");
    if (context) { context.scale(ratio, ratio); context.lineCap = "round"; context.lineJoin = "round"; context.lineWidth = 3; context.strokeStyle = "#142846"; }
  }, []);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => { const canvas = canvasRef.current!; const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * (720 / rect.width), y: (event.clientY - rect.top) * (220 / rect.height) }; };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => { const canvas = canvasRef.current; const context = canvas?.getContext("2d"); if (!canvas || !context) return; canvas.setPointerCapture(event.pointerId); const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); setDrawing(true); setHasInk(true); };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing) return; const context = canvasRef.current?.getContext("2d"); if (!context) return; const p = point(event); context.lineTo(p.x, p.y); context.stroke(); };
  const finish = () => { if (!drawing) return; setDrawing(false); if (canvasRef.current) onChange(canvasRef.current.toDataURL("image/png")); };
  const clear = () => { const canvas = canvasRef.current; const context = canvas?.getContext("2d"); if (!canvas || !context) return; context.clearRect(0, 0, 720, 220); setHasInk(false); onChange(""); };
  return <div><div className="relative overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white"><canvas ref={canvasRef} width={720} height={220} className="block h-[150px] w-full touch-none cursor-crosshair" aria-label="Draw your signature in this box" role="img" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onPointerLeave={finish} /><span className="pointer-events-none absolute bottom-3 left-4 text-xs text-slate-400">Draw signature here</span></div><div className="mt-2 flex items-center justify-between gap-2"><p className="text-[11px] text-slate-500">Use a finger, stylus, mouse, or trackpad. Your signature is stored as a case-linked PNG with an integrity hash.</p><button type="button" onClick={clear} disabled={!hasInk} className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 disabled:opacity-40">Clear</button></div></div>;
}
