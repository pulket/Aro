interface Props {
  history: string[];
  onSelect: (value: string) => void;
}

export default function HistoryDropdown({ history, onSelect }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="border-t border-[var(--rule)] px-2 py-2">
      {history.slice(0, 6).map((item) => (
        <button
          className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-[var(--muted)] hover:bg-white/[0.06] hover:text-[var(--ink)]"
          key={item}
          onClick={() => onSelect(item)}
          type="button"
        >
          {item}
        </button>
      ))}
    </div>
  );
}
