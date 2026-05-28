import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { File, HelpCircle, Lightbulb, Send, X } from "lucide-react";

interface Props {
  loading: boolean;
  question: string;
  onCancel: () => void;
  onSubmit: (answer: string) => void;
}

export default function ClarificationCard({ loading, question, onCancel, onSubmit }: Props) {
  const [answer, setAnswer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [question]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && answer.trim()) {
      onSubmit(answer.trim());
      setAnswer("");
    }
  };

  return (
    <section className="animate-slide-in relative flex h-[212px] gap-4 border-t border-[var(--rule)] bg-white/[0.36] px-6 py-4">
      <div className="min-w-0 flex-1">
        <div className="mb-3 rounded-[20px] border border-[var(--accent-rule)] bg-[var(--accent-soft)] px-4 py-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
            <HelpCircle size={16} />
            Need one detail
          </div>
          <p className="text-[15px] font-semibold leading-relaxed text-[var(--ink)]">{question}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
            <Lightbulb size={13} />
            You can also select the file in Finder and run the request again.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-[16px] border border-[var(--rule)] bg-white/[0.72] px-3 py-2 shadow-[var(--shadow-control)]">
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            disabled={loading}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type the exact file name..."
            value={answer}
          />
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-black/[0.04] hover:text-[var(--ink)]"
            onClick={onCancel}
            type="button"
          >
            <X size={15} />
          </button>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-[13px] accent-fill text-white shadow-[0_8px_20px_rgba(247,97,92,0.26)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading || !answer.trim()}
            onClick={() => {
              onSubmit(answer.trim());
              setAnswer("");
            }}
            type="button"
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      <div className="hidden w-[128px] shrink-0 flex-col items-center justify-center rounded-[22px] border border-[var(--rule)] bg-white/[0.54] text-center text-[12px] text-[var(--muted)] shadow-[var(--shadow-control)] sm:flex">
        <File size={34} className="mb-3 text-[var(--faint)]" />
        No file selected
      </div>
    </section>
  );
}
