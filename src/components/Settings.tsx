import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Brain,
  Check,
  ChevronLeft,
  ExternalLink,
  Eye,
  Home,
  KeyRound,
  Lock,
  Pin,
  PinOff,
  RefreshCcw,
  Save,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import {
  emptyStore,
  forgetMemory,
  loadMemory,
  pinMemory,
  saveMemory,
  scoreRecord,
  type MemoryStore,
} from "../lib/memory";
import {
  AUTO_RUN_OPTIONS,
  PROVIDERS,
  cloneLlmSettings,
  providerById,
  type AutoRunCategory,
  type LlmSettings,
  type PersonalizationSettings,
  type ProviderCredentials,
  type ProviderId,
} from "../lib/llm-settings";
import type { LocalModelStatus } from "../types";

interface Props {
  settings: LlmSettings;
  onBack: () => void;
  onOpenOnboarding: () => void;
  onSave: (settings: LlmSettings) => void;
}

type SettingsSectionId =
  | "general"
  | "providers"
  | "memory"
  | "safety"
  | "brain"
  | "permissions";

const navItems: Array<{
  id: SettingsSectionId;
  label: string;
  Icon: typeof SlidersHorizontal;
}> = [
  { id: "general", label: "General", Icon: Home },
  { id: "providers", label: "Providers", Icon: Sparkles },
  { id: "safety", label: "Safety", Icon: ShieldCheck },
  { id: "brain", label: "Personal Brain", Icon: Brain },
  { id: "memory", label: "Memory", Icon: Pin },
  { id: "permissions", label: "Permissions", Icon: KeyRound },
];

function openPrivacyPane(pane: "Automation" | "Accessibility" | "ListenEvent") {
  void openUrl(`x-apple.systempreferences:com.apple.preference.security?Privacy_${pane}`);
}

export default function Settings({ settings, onBack, onOpenOnboarding, onSave }: Props) {
  const [draft, setDraft] = useState<LlmSettings>(() => cloneLlmSettings(settings));
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("providers");
  const [localStatus, setLocalStatus] = useState<LocalModelStatus | null>(null);
  const [checkingLocal, setCheckingLocal] = useState(false);
  const [memory, setMemory] = useState<MemoryStore>(() => emptyStore());
  const sectionRefs = useRef<Record<SettingsSectionId, HTMLElement | null>>({
    brain: null,
    general: null,
    memory: null,
    permissions: null,
    providers: null,
    safety: null,
  });

  useEffect(() => {
    setDraft(cloneLlmSettings(settings));
  }, [settings]);

  useEffect(() => {
    void loadMemory().then(setMemory);
  }, []);

  useEffect(() => {
    let dispose: (() => void) | null = null;
    void listen<MemoryStore>("aro:memory-updated", (event) => {
      if (event.payload) setMemory(event.payload);
    }).then((unlisten) => {
      dispose = unlisten;
    });
    return () => {
      dispose?.();
    };
  }, []);

  const activeProvider = providerById(draft.activeProvider);
  const activeCredentials = draft.providers[activeProvider.id];
  const canEditApiKey = activeProvider.apiKeyEditable ?? activeProvider.requiresApiKey;
  const showLocalHealth = activeProvider.id === "ollama";

  const updateProvider = (providerId: ProviderId, patch: Partial<ProviderCredentials>) => {
    setDraft((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [providerId]: {
          ...current.providers[providerId],
          ...patch,
        },
      },
    }));
  };

  const selectProvider = (providerId: ProviderId) => {
    setDraft((current) => ({ ...current, activeProvider: providerId, providerChosen: true }));
  };

  const toggleAutoRun = (category: AutoRunCategory) => {
    setDraft((current) => {
      const enabled = current.autoRunCategories.includes(category);
      return {
        ...current,
        autoRunCategories: enabled
          ? current.autoRunCategories.filter((item) => item !== category)
          : [...current.autoRunCategories, category],
      };
    });
  };

  const updatePersonalization = (patch: Partial<PersonalizationSettings>) => {
    setDraft((current) => ({
      ...current,
      personalization: {
        ...current.personalization,
        ...patch,
      },
    }));
  };

  const jumpToSection = (sectionId: SettingsSectionId) => {
    setActiveSection(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const checkLocalStatus = async () => {
    setCheckingLocal(true);
    try {
      const status = await invoke<LocalModelStatus>("check_local_model_status", {
        baseUrl: activeCredentials.baseUrl,
        model: activeCredentials.model,
      });
      setLocalStatus(status);
    } catch (error) {
      setLocalStatus({
        base_url: activeCredentials.baseUrl,
        running: false,
        model_available: false,
        models: [],
        message: String(error),
      });
    } finally {
      setCheckingLocal(false);
    }
  };

  useEffect(() => {
    if (showLocalHealth) {
      void checkLocalStatus();
    } else {
      setLocalStatus(null);
    }
  }, [showLocalHealth]);

  const handleForgetMemory = async (id: string) => {
    const next = forgetMemory(memory, id);
    setMemory(next);
    await saveMemory(next);
  };

  const handlePinMemory = async (id: string, pinned: boolean) => {
    const next = pinMemory(memory, id, pinned);
    setMemory(next);
    await saveMemory(next);
  };

  const handleClearMemory = async () => {
    const next = emptyStore();
    setMemory(next);
    await saveMemory(next);
  };

  return (
    <main className="settings-shell flex h-screen overflow-hidden rounded-[24px] border border-[var(--rule)] text-[var(--ink)]">
      <aside className="flex w-[230px] shrink-0 flex-col border-r border-[var(--rule)] bg-white/[0.48] p-5">
        <div className="mb-8 h-7 text-center text-xs text-[var(--muted)]">Aro v0.2.0</div>

        <nav className="space-y-1.5 text-sm">
          {navItems.map(({ id, label, Icon }) => (
            <button
              className={`flex h-11 w-full items-center gap-3 rounded-[12px] px-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                activeSection === id
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-black/[0.045] hover:text-[var(--ink)]"
              }`}
              key={id}
              onClick={() => jumpToSection(id)}
              type="button"
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-[14px] border border-[var(--rule)] bg-white/[0.54] p-3 text-[11px] leading-relaxed text-[var(--muted)]">
          Made with love in India by Pulkit.
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--rule)] px-6">
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-[12px] px-2.5 text-sm text-[var(--muted)] transition hover:bg-black/[0.04] hover:text-[var(--ink)]"
            onClick={onBack}
            type="button"
          >
            <ChevronLeft size={16} />
            Back
          </button>
          <div className="text-center">
            <p className="text-[13px] font-semibold text-[var(--muted)]">Aro Settings</p>
          </div>
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-[12px] px-2.5 text-sm text-[var(--muted)] transition hover:bg-black/[0.04] hover:text-[var(--ink)]"
            onClick={onOpenOnboarding}
            type="button"
          >
            Setup
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-6 overflow-auto px-6 py-6">
          <section
            ref={(element) => {
              sectionRefs.current.providers = element;
            }}
          >
            <h1 className="text-xl font-semibold tracking-[-0.02em]">Providers</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Choose your AI provider and configure it.
            </p>

            <div className="mt-5 rounded-[14px] border border-[var(--rule)] bg-white/[0.58] p-1">
              <div className="grid grid-cols-6 gap-1">
                {PROVIDERS.map((provider) => {
                  const selected = provider.id === draft.activeProvider;
                  return (
                    <button
                      className={`h-10 rounded-[11px] px-2 text-center text-[13px] font-medium transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                        selected
                          ? "accent-fill shadow-[0_8px_18px_rgba(247,97,92,0.24)]"
                          : "text-[var(--ink-soft)] hover:bg-black/[0.04]"
                      }`}
                      key={provider.id}
                      onClick={() => selectProvider(provider.id)}
                      type="button"
                    >
                      <span className="truncate">{provider.shortName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[1fr_210px] gap-5">
              <div className="rounded-[18px] border border-[var(--rule)] bg-white/[0.58] p-4">
                <div className="mb-4">
                  <p className="text-sm font-semibold">{activeProvider.name} provider</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{activeProvider.description}</p>
                </div>

                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs text-[var(--muted)]">
                      {activeProvider.apiKeyLabel}
                    </span>
                    <div className="flex h-11 items-center rounded-[12px] border border-[var(--rule)] bg-white/[0.68] px-3">
                      <input
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--faint)] disabled:opacity-50"
                        disabled={!canEditApiKey}
                        onChange={(event) =>
                          updateProvider(activeProvider.id, { apiKey: event.target.value })
                        }
                        placeholder={activeProvider.apiKeyPlaceholder}
                        type="password"
                        value={canEditApiKey ? activeCredentials.apiKey : ""}
                      />
                      <Eye size={15} className="text-[var(--faint)]" />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs text-[var(--muted)]">Model</span>
                    <input
                      className="h-11 w-full rounded-[12px] border border-[var(--rule)] bg-white/[0.68] px-3 font-mono text-sm outline-none focus:border-[var(--accent)]"
                      list={`${activeProvider.id}-models`}
                      onChange={(event) =>
                        updateProvider(activeProvider.id, { model: event.target.value })
                      }
                      value={activeCredentials.model}
                    />
                    <datalist id={`${activeProvider.id}-models`}>
                      {activeProvider.modelOptions.map((model) => (
                        <option key={model} value={model} />
                      ))}
                    </datalist>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs text-[var(--muted)]">Base URL</span>
                    <input
                      className="h-11 w-full rounded-[12px] border border-[var(--rule)] bg-white/[0.68] px-3 font-mono text-sm outline-none disabled:opacity-50 focus:border-[var(--accent)]"
                      disabled={!activeProvider.baseUrlEditable}
                      onChange={(event) =>
                        updateProvider(activeProvider.id, { baseUrl: event.target.value })
                      }
                      value={activeCredentials.baseUrl}
                    />
                  </label>

                  {showLocalHealth && (
                    <div className="rounded-[14px] border border-[var(--rule)] bg-[var(--surface-code)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-xs font-semibold">
                            <Server size={14} />
                            Local model health
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
                            {localStatus?.message ??
                              "Local mode expects an OpenAI-compatible server such as Ollama or LM Studio."}
                          </p>
                        </div>
                        <button
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[11px] border border-[var(--rule)] px-3 text-[11px] text-[var(--ink-soft)] hover:bg-black/[0.04] disabled:opacity-50"
                          disabled={checkingLocal}
                          onClick={checkLocalStatus}
                          type="button"
                        >
                          <RefreshCcw
                            size={12}
                            className={checkingLocal ? "animate-spin" : ""}
                          />
                          Check
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <aside className="rounded-[18px] border border-[var(--rule)] bg-white/[0.45] p-4">
                <p className="text-sm font-semibold">Security note</p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                  Keys are stored in the local Tauri app store on this Mac. They are not written
                  into the source tree or release archive.
                </p>
                {activeProvider.consoleUrl && (
                  <button
                    className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-[11px] border border-[var(--rule)] px-3 text-xs text-[var(--ink-soft)] hover:bg-black/[0.04]"
                    onClick={() => void openUrl(activeProvider.consoleUrl!)}
                    type="button"
                  >
                    Provider console
                    <ExternalLink size={12} />
                  </button>
                )}
              </aside>
            </div>
          </section>

          <section
            className="settings-section"
            ref={(element) => {
              sectionRefs.current.safety = element;
            }}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={16} />
              Safety & execution
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              System commands, unknown actions, network calls, and destructive operations always
              require review.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {AUTO_RUN_OPTIONS.map((option) => {
                const enabled = draft.autoRunCategories.includes(option.category);
                return (
                  <button
                    className={`min-h-[92px] rounded-[14px] border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                      enabled
                        ? "border-[var(--success-rule)] bg-[var(--success-soft)] text-[var(--ink)]"
                        : "border-[var(--rule)] bg-white/[0.46] text-[var(--muted)] hover:bg-black/[0.035] hover:text-[var(--ink)]"
                    }`}
                    key={option.category}
                    onClick={() => toggleAutoRun(option.category)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-2 text-xs font-semibold">
                      {option.label}
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          enabled
                            ? "border-[var(--success-rule)] bg-[var(--success)] text-white"
                            : "border-[var(--rule)]"
                        }`}
                      >
                        {enabled && <Check size={12} />}
                      </span>
                    </span>
                    <span className="mt-1 block text-[10px] leading-snug opacity-80">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className="settings-section"
            ref={(element) => {
              sectionRefs.current.brain = element;
            }}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Brain size={16} />
              Personal Brain
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-xs text-[var(--muted)]">Command style</span>
                <select
                  className="h-11 w-full rounded-[12px] border border-[var(--rule)] bg-white/[0.68] px-3 text-sm outline-none"
                  onChange={(event) =>
                    updatePersonalization({
                      commandStyle: event.target.value as PersonalizationSettings["commandStyle"],
                    })
                  }
                  value={draft.personalization.commandStyle}
                >
                  <option value="careful">Careful and ask when unsure</option>
                  <option value="fast">Fast and direct</option>
                  <option value="verbose">Extra cautious with previews</option>
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs text-[var(--muted)]">New files go</span>
                <select
                  className="h-11 w-full rounded-[12px] border border-[var(--rule)] bg-white/[0.68] px-3 text-sm outline-none"
                  onChange={(event) =>
                    updatePersonalization({
                      outputNaming: event.target.value as PersonalizationSettings["outputNaming"],
                    })
                  }
                  value={draft.personalization.outputNaming}
                >
                  <option value="same_folder">Same folder</option>
                  <option value="subfolder">New subfolder</option>
                  <option value="ask">Ask me each time</option>
                </select>
              </label>
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs text-[var(--muted)]">
                How Aro should think for you
              </span>
              <textarea
                className="min-h-[88px] w-full resize-none rounded-[14px] border border-[var(--rule)] bg-white/[0.68] px-3 py-2 text-sm leading-relaxed outline-none"
                onChange={(event) =>
                  updatePersonalization({ customInstructions: event.target.value })
                }
                placeholder="Example: never overwrite originals, prefer built-in macOS commands..."
                value={draft.personalization.customInstructions}
              />
            </label>
          </section>

          <section
            className="settings-section"
            ref={(element) => {
              sectionRefs.current.memory = element;
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Pin size={16} />
                  Memory
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Successful runs become editable local notes. They never leave this Mac except as
                  prompt context for the provider you choose.
                </p>
              </div>
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-[11px] border border-[var(--rule)] px-3 text-xs text-[var(--muted)] hover:bg-black/[0.04] hover:text-[var(--danger)] disabled:opacity-40"
                disabled={memory.records.length === 0}
                onClick={() => void handleClearMemory()}
                type="button"
              >
                <Trash2 size={12} />
                Clear
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {memory.records.length === 0 ? (
                <div className="rounded-[14px] border border-dashed border-[var(--rule)] bg-white/[0.42] px-3 py-5 text-center text-xs text-[var(--muted)]">
                  No learned patterns yet.
                </div>
              ) : (
                [...memory.records]
                  .sort((a, b) => scoreRecord(b) - scoreRecord(a))
                  .slice(0, 12)
                  .map((record) => (
                    <div
                      className="flex items-start gap-2 rounded-[14px] border border-[var(--rule)] bg-white/[0.46] px-3 py-2"
                      key={record.id}
                    >
                      <p className="min-w-0 flex-1 text-xs leading-snug text-[var(--ink-soft)]">
                        {record.text}
                      </p>
                      <button
                        aria-label={record.pinned ? "Unpin memory" : "Pin memory"}
                        className="text-[var(--faint)] hover:text-[var(--accent)]"
                        onClick={() => void handlePinMemory(record.id, !record.pinned)}
                        type="button"
                      >
                        {record.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button
                        aria-label="Forget memory"
                        className="text-[var(--faint)] hover:text-[var(--danger)]"
                        onClick={() => void handleForgetMemory(record.id)}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
              )}
            </div>
          </section>

          <section
            className="settings-section"
            ref={(element) => {
              sectionRefs.current.permissions = element;
            }}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Lock size={16} />
              Permissions
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Finder context uses Automation. Global shortcuts may need Accessibility or Input
              Monitoring depending on your macOS privacy state.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="settings-pill" onClick={() => openPrivacyPane("Automation")} type="button">
                Automation
              </button>
              <button className="settings-pill" onClick={() => openPrivacyPane("Accessibility")} type="button">
                Accessibility
              </button>
              <button className="settings-pill" onClick={() => openPrivacyPane("ListenEvent")} type="button">
                Input Monitoring
              </button>
            </div>
          </section>

          <section
            className="settings-section"
            ref={(element) => {
              sectionRefs.current.general = element;
            }}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Zap size={16} />
              General
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              Control + Space summons Aro below the front Finder window. Escape works when Aro has
              focus; the visible Hide button is the reliable close control.
            </p>
          </section>
        </div>

        <footer className="shrink-0 border-t border-[var(--rule)] bg-white/[0.38] px-6 py-4">
          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[13px] accent-fill text-sm font-semibold text-white shadow-[0_10px_24px_rgba(247,97,92,0.28)]"
            onClick={() => onSave(draft)}
            type="button"
          >
            <Save size={15} />
            Save settings
          </button>
        </footer>
      </section>
    </main>
  );
}
