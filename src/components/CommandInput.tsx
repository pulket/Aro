import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Command, FileText, Folder, Settings, Sparkles, TriangleAlert, X } from "lucide-react";
import AroMark from "./AroMark";
import type { FinderContext } from "../types";

interface Props {
  finderContext: FinderContext | null;
  finderError: string;
  focusSignal: number;
  history: string[];
  historyIndex: number;
  loading: boolean;
  onRefreshContext: () => void;
  onRequestHide: () => void;
  onSettingsClick: () => void;
  onSubmit: (input: string) => void;
  setHistoryIndex: (index: number) => void;
}

export default function CommandInput({
  finderContext,
  finderError,
  focusSignal,
  history,
  historyIndex,
  loading,
  onRefreshContext,
  onRequestHide,
  onSettingsClick,
  onSubmit,
  setHistoryIndex,
}: Props) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    onRefreshContext();
  }, [focusSignal, onRefreshContext]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && input.trim()) {
      onSubmit(input.trim());
      setInput("");
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(nextIndex);
      if (history[nextIndex]) setInput(history[nextIndex]);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(nextIndex);
      setInput(nextIndex === -1 ? "" : history[nextIndex]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onRequestHide();
      return;
    }

    if (event.key === "," && event.metaKey) {
      event.preventDefault();
      onSettingsClick();
    }
  };

  const fileCount = finderContext?.selected_files?.length ?? 0;
  const visibleItemCount = finderContext?.directory_items?.length ?? 0;
  const dirName = finderContext?.current_directory?.split("/").filter(Boolean).pop() ?? "Desktop";
  const fileLabel =
    fileCount > 0
      ? `${fileCount} selected`
      : visibleItemCount > 0
        ? `${visibleItemCount} visible`
        : "No files";

  return (
    <section className="relative flex h-[178px] flex-col px-6 py-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white/80 shadow-[var(--shadow-control)]">
          <AroMark size={26} />
        </div>
        <div className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--ink)]">Aro</div>
        <div className="ml-3 flex min-w-0 flex-1 items-center gap-2 text-[12px] text-[var(--muted)]">
          {finderError ? (
            <span
              className="flex max-w-[230px] items-center gap-1.5 truncate rounded-[12px] border border-[var(--warning-rule)] bg-[var(--warning-soft)] px-3 py-2 text-[var(--warning)]"
              title={finderError}
            >
              <TriangleAlert size={14} />
              <span className="truncate">Finder permission needed</span>
            </span>
          ) : (
            <span className="soft-control flex max-w-[210px] items-center gap-2 truncate rounded-[12px] px-3 py-2">
              <Folder size={15} />
              <span className="truncate">{dirName}</span>
            </span>
          )}

          <span className="soft-control flex items-center gap-2 rounded-[12px] px-3 py-2">
            <FileText size={14} />
            {fileLabel}
          </span>
        </div>

        <span className="soft-control hidden h-9 items-center gap-1.5 rounded-[12px] px-3 text-[12px] text-[var(--muted)] sm:flex">
          <Command size={13} />
          K
        </span>

        <button
          aria-label="Settings"
          className="soft-control flex h-10 w-10 items-center justify-center rounded-[13px] text-[var(--muted)] transition hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          onClick={onSettingsClick}
          title="Settings (Command + comma)"
          type="button"
        >
          <Settings size={17} />
        </button>
      </div>

      <div className="rounded-[17px] border border-[var(--accent-rule)] bg-white/[0.72] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
        <input
          ref={inputRef}
          autoFocus
          className="h-8 w-full min-w-0 bg-transparent text-[17px] text-[var(--ink)] caret-[var(--accent-hot)] outline-none placeholder:text-[var(--faint)]"
          disabled={loading}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell Aro what to do..."
          type="text"
          value={input}
        />
        {loading && <div className="absolute right-20 top-[93px] h-4 w-4 animate-spin rounded-full border-2 border-[var(--rule)] border-t-[var(--accent)]" />}
      </div>

      <div className="mt-4 flex min-h-8 items-center justify-between gap-4 text-[12px] text-[var(--muted)]">
        <span className="flex min-w-0 items-center gap-2 truncate">
          <Sparkles size={14} className="text-[var(--accent)]" />
          <span className="truncate">
            Try: "rename selected file to receipt.txt" or "compress this folder"
          </span>
        </span>
        <button
          className="soft-control inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[13px] px-3 text-[12px] text-[var(--muted)] transition hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          onClick={onRequestHide}
          type="button"
        >
          <X size={12} />
          Hide
        </button>
      </div>
    </section>
  );
}
