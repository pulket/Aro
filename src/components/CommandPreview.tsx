import {
  CheckCircle2,
  CircleHelp,
  FilePlus2,
  MonitorCog,
  PencilLine,
  Play,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import type { Prediction } from "../types";

interface Props {
  command: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  prediction: Prediction | null;
}

const riskClass: Record<Prediction["risk_level"], string> = {
  low: "border-[var(--success-rule)] bg-[var(--success-soft)] text-[var(--success)]",
  medium: "border-[var(--warning-rule)] bg-[var(--warning-soft)] text-[var(--warning)]",
  high: "border-[var(--danger-rule)] bg-[var(--danger-soft)] text-[var(--danger)]",
};

const categoryIcon = {
  safe: CheckCircle2,
  creates_files: FilePlus2,
  modifies_files: PencilLine,
  deletes_files: Trash2,
  network: Wifi,
  system: MonitorCog,
  unknown: CircleHelp,
};

export default function CommandPreview({
  command,
  loading,
  onCancel,
  onConfirm,
  prediction,
}: Props) {
  const Icon = prediction ? categoryIcon[prediction.category] : CircleHelp;

  return (
    <section className="animate-slide-in flex h-[152px] flex-col border-t border-[var(--rule)] bg-white/[0.26] px-6 py-4">
      <pre className="mb-3 max-h-[82px] min-h-0 select-all overflow-auto whitespace-pre-wrap break-words rounded-[20px] border border-[var(--rule)] bg-[var(--surface-code)] px-4 py-3 font-mono text-xs leading-relaxed text-[var(--code)] shadow-[var(--shadow-control)]">
        <span className="text-[var(--faint)]">$ </span>
        {command}
      </pre>

      <div className="mt-auto flex items-center justify-between gap-3">
        {prediction ? (
          <div className="min-w-0">
            <span
              className={`inline-flex max-w-[460px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${riskClass[prediction.risk_level]}`}
            >
              <Icon size={13} />
              <span className="truncate">{prediction.description}</span>
            </span>
          </div>
        ) : (
          <span className="text-xs text-[var(--muted)]">Predicting side effects...</span>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs text-[var(--muted)] transition hover:bg-white/[0.08] hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            onClick={onCancel}
            type="button"
          >
            <X size={14} />
            Cancel
          </button>
          <button
            className="inline-flex h-10 items-center gap-1.5 rounded-[14px] accent-fill px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(247,97,92,0.24)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            disabled={loading || !prediction}
            onClick={onConfirm}
            type="button"
          >
            <Play size={14} fill="currentColor" />
            {loading ? "Running" : "Run"}
          </button>
        </div>
      </div>
    </section>
  );
}
