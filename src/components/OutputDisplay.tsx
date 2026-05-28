import { CheckCircle2, RotateCcw, X, XCircle } from "lucide-react";
import type { CommandResult } from "../types";

interface Props {
  loading: boolean;
  result: CommandResult;
  onDismiss: () => void;
  onUndo: (command: string) => void;
}

export default function OutputDisplay({ loading, result, onDismiss, onUndo }: Props) {
  const output = result.stdout || result.stderr || "Command completed with no output.";
  const StatusIcon = result.success ? CheckCircle2 : XCircle;
  const undoCommand = result.success ? result.undo_command : null;

  return (
    <section className="border-t border-[var(--rule)] bg-white/[0.28] px-6 py-4">
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            result.success ? "text-[var(--success)]" : "text-[var(--danger)]"
          }`}
        >
          <StatusIcon size={14} />
          {result.success ? "Success" : `Exit code ${result.exit_code}`}
        </span>

        <div className="flex items-center gap-2">
          {undoCommand && (
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--accent-rule)] bg-[var(--accent-soft)] px-3 text-xs font-medium text-[var(--accent)] transition hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
              disabled={loading}
              onClick={() => onUndo(undoCommand)}
              type="button"
            >
              <RotateCcw size={13} />
              Undo
            </button>
          )}
          <button
            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs text-[var(--muted)] transition hover:bg-white/[0.08] hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            onClick={onDismiss}
            type="button"
          >
            <X size={13} />
            Dismiss
          </button>
        </div>
      </div>

      {undoCommand && (
        <p className="mb-2 rounded-full border border-[var(--accent-rule)] bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] text-[var(--ink-soft)]">
          Aro saved a reversible action for this rename or move.
        </p>
      )}

      <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap break-words rounded-[22px] border border-[var(--rule)] bg-[var(--surface-code)] p-4 font-mono text-xs leading-relaxed text-[var(--ink-soft)] shadow-[var(--shadow-control)]">
        {output}
      </pre>
    </section>
  );
}
