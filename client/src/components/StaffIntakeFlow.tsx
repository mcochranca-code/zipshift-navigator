import React from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, MapPin, ShieldCheck } from "lucide-react";
import { useState } from "react";

type StaffIntakeFlowProps = { onBack: () => void; onComplete: (caseId: string) => void };

type IntakeState = { name: string; phone: string; situation: string; need: string; barrier: string; priority: "standard" | "high" | "urgent" | "low"; destination: string; consent: boolean };

export default function StaffIntakeFlow({ onBack, onComplete }: StaffIntakeFlowProps) {
  const [step, setStep] = useState<"connect" | "details" | "complete">("connect");
  const [state, setState] = useState<IntakeState>({ name: "", phone: "", situation: "", need: "Emergency shelter", barrier: "Transportation", priority: "high", destination: "Emergency Shelter & Housing Navigation", consent: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = <K extends keyof IntakeState>(key: K, value: IntakeState[K]) => setState((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!state.name.trim() || !state.consent) { setError("Enter the client name and document consent before submitting."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/intake", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: state.name.trim(), phone: state.phone.trim() || null, situation: state.situation.trim() || null, needs: [state.need], consent: state.consent, priority: state.priority, providerId: null, handoff: { outcome: "needs-review", failureReason: state.barrier, documentBurden: "none", transitFeasibility: "not-assessed", reviewConfirmed: true, destination: state.destination } }) });
      const payload = await response.json().catch(() => ({})) as { caseId?: string; error?: string };
      if (!response.ok || !payload.caseId) throw new Error(payload.error || "Unable to connect this intake to ZipShift.");
      setStep("complete"); onComplete(payload.caseId);
    } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : "Unable to save the staff intake."); }
    finally { setSaving(false); }
  };
  return <main className="zipshift-staff-flow" aria-labelledby="staff-intake-title">
    <div className="zipshift-flow-topbar"><button type="button" className="zipshift-icon-button" onClick={onBack} aria-label="Back to portal"><ArrowLeft size={19} /></button><div><span className="zipshift-kicker">STAFF INTAKE</span><h1 id="staff-intake-title">Connect to ZipShift</h1></div><span className="zipshift-status-pill"><ShieldCheck size={14} /> Authorized</span></div>
    {step === "connect" && <section className="zipshift-flow-panel zipshift-motion-panel"><div className="zipshift-flow-mark"><ClipboardList size={22} /></div><h2>Move the social-service need into a verified navigation workflow.</h2><p>Capture only the minimum information needed to start a referral case. You can complete the handoff and continue the encounter from the staff workspace.</p><div className="zipshift-handoff-summary"><div><small>NEED</small><strong>{state.need}</strong></div><div><small>BARRIER</small><strong>{state.barrier}</strong></div><div><small>PRIORITY</small><strong>{state.priority[0].toUpperCase() + state.priority.slice(1)}</strong></div><div><small>CLIENT CONSENT</small><strong>{state.consent ? "Documented" : "Required"}</strong></div></div><div className="zipshift-destination-callout"><small>ZIPSHIFT DESTINATION</small><strong>{state.destination}</strong><button type="button" onClick={() => setStep("details")}>Open ZipShift workflow</button></div></section>}
    {step === "details" && <section className="zipshift-flow-panel zipshift-motion-panel"><div className="zipshift-flow-progress"><span className="active" /><span /><span /></div><h2>Staff intake details</h2><p>Complete the referral handoff without exposing unnecessary clinical detail.</p><div className="zipshift-form-grid"><label>Client name<input value={state.name} onChange={(event) => update("name", event.target.value)} placeholder="Full name" /></label><label>Phone number<input value={state.phone} onChange={(event) => update("phone", event.target.value)} placeholder="Optional contact number" /></label><label>Need<select value={state.need} onChange={(event) => update("need", event.target.value)}><option>Emergency shelter</option><option>Food assistance</option><option>Medical care</option><option>Behavioral health</option><option>Transportation</option></select></label><label>Priority<select value={state.priority} onChange={(event) => update("priority", event.target.value as IntakeState["priority"])}><option value="urgent">Urgent</option><option value="high">High</option><option value="standard">Standard</option><option value="low">Low</option></select></label><label className="wide">Barrier<textarea value={state.barrier} onChange={(event) => update("barrier", event.target.value)} placeholder="Document the access barrier" /></label><label className="wide">Situation<textarea value={state.situation} onChange={(event) => update("situation", event.target.value)} placeholder="Brief context for the receiving team" /></label></div><label className="zipshift-consent-check"><input type="checkbox" checked={state.consent} onChange={(event) => update("consent", event.target.checked)} /> Client consent is documented for this referral handoff.</label>{error && <p className="zipshift-form-error" role="alert">{error}</p>}<div className="zipshift-flow-actions"><button type="button" className="zipshift-secondary-button" onClick={() => setStep("connect")}>Back</button><button type="button" className="zipshift-primary-button" disabled={saving} onClick={submit}>{saving ? "Connecting…" : "Connect to ZipShift"}</button></div></section>}
    {step === "complete" && <section className="zipshift-flow-panel zipshift-motion-panel zipshift-complete-panel"><div className="zipshift-success-mark"><CheckCircle2 size={28} /></div><h2>Referral connected</h2><p>The case is now available in Referrals Dispatch and the receiving team can continue the workflow.</p><button type="button" className="zipshift-primary-button" onClick={onBack}><MapPin size={16} /> Return to workspace</button></section>}
  </main>;
}
