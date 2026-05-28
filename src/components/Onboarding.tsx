import { useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  KeyRound,
  LockKeyhole,
  MousePointer2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import AroMark from "./AroMark";
import {
  AUTO_RUN_OPTIONS,
  PROVIDERS,
  cloneLlmSettings,
  providerById,
  type AutoRunCategory,
  type LlmSettings,
  type ProviderCredentials,
  type ProviderId,
} from "../lib/llm-settings";
import type { FinderContext } from "../types";

interface Props {
  finderContext: FinderContext | null;
  finderError: string;
  onCheckFinder: () => Promise<FinderContext | null>;
  onComplete: (settings: LlmSettings) => void;
  settings: LlmSettings;
}

type FinderPermissionState = "idle" | "checking" | "ok" | "blocked";

function openPrivacyPane(pane: "Automation" | "Accessibility" | "ListenEvent") {
  void openUrl(`x-apple.systempreferences:com.apple.preference.security?Privacy_${pane}`);
}

export default function Onboarding({
  finderContext,
  finderError,
  onCheckFinder,
  onComplete,
  settings,
}: Props) {
  const [draft, setDraft] = useState<LlmSettings>(() => cloneLlmSettings(settings));
  const [step, setStep] = useState(0);
  const [finderState, setFinderState] = useState<FinderPermissionState>(
    finderContext ? "ok" : "idle",
  );

  useEffect(() => {
    setDraft(cloneLlmSettings(settings));
  }, [settings]);

  const activeProvider = providerById(draft.activeProvider);
  const activeCredentials = draft.providers[activeProvider.id];
  const hasApiKey = !activeProvider.requiresApiKey || Boolean(activeCredentials.apiKey.trim());
  const canEditApiKey = activeProvider.apiKeyEditable ?? activeProvider.requiresApiKey;
  const canContinueModelStep = draft.providerChosen && hasApiKey;
  const canFinish = draft.providerChosen && hasApiKey;

  const steps = useMemo(
    () => [
      {
        eyebrow: "Start",
        title: "Meet Aro",
        body: "A small command bar that understands Finder context before it suggests a shell command.",
      },
      {
        eyebrow: "macOS",
        title: "Connect Finder",
        body: "Aro needs Automation permission to read your selected files and current folder.",
      },
      {
        eyebrow: "AI",
        title: "Choose a model",
        body: "Add the provider key you want to use. You can change this any time.",
      },
      {
        eyebrow: "Safety",
        title: "Ready to run",
        body: "Pick which low-risk commands can run without another click.",
      },
    ],
    [],
  );

  const updateProvider = (
    providerId: ProviderId,
    patch: Partial<ProviderCredentials>,
  ) => {
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
    setDraft((current) => ({
      ...current,
      activeProvider: providerId,
      providerChosen: true,
    }));
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

  const checkFinder = async () => {
    setFinderState("checking");
    const context = await onCheckFinder();
    setFinderState(context ? "ok" : "blocked");
  };

  const nextStep = () => setStep((value) => Math.min(value + 1, steps.length - 1));
  const previousStep = () => setStep((value) => Math.max(value - 1, 0));

  return (
    <main className="app-shell flex h-screen overflow-hidden rounded-[30px] border border-[var(--rule)] text-[var(--ink)] shadow-[0_24px_80px_rgba(58,23,84,0.42)] backdrop-blur-2xl">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-[var(--rule)] p-5">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] bg-white/[0.08] shadow-[0_14px_34px_rgba(38,18,48,0.24)]">
            <AroMark size={52} />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--accent-hot)]">
              Aro
            </p>
            <p className="text-sm font-semibold">First run setup</p>
          </div>
        </div>

        <div className="space-y-2">
          {steps.map((item, index) => {
            const active = index === step;
            const done = index < step;
            return (
              <button
                className={`w-full rounded-[18px] border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                  active
                    ? "border-[var(--accent-rule)] bg-[var(--accent-soft)]"
                    : "border-transparent text-[var(--muted)] hover:border-[var(--rule)] hover:bg-white/[0.04]"
                }`}
                key={item.title}
                onClick={() => setStep(index)}
                type="button"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
                    {item.eyebrow}
                  </span>
                  {done && <CheckCircle2 size={14} className="text-[var(--success)]" />}
                </span>
                <span className="mt-1 block text-sm font-semibold text-[var(--ink)]">
                  {item.title}
                </span>
                <span className="mt-1 block text-[11px] leading-snug">{item.body}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-auto text-[11px] leading-relaxed text-[var(--faint)]">
          You can reopen this guide from Settings. Permissions stay under your macOS privacy
          controls.
        </p>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col p-6">
        {step === 0 && (
          <div className="grid h-full grid-cols-[1fr_220px] items-center gap-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent-hot)]">
                Natural language to local action
              </p>
              <h1 className="mt-3 max-w-[420px] text-3xl font-semibold leading-tight">
                Tell Aro what to do with the files in front of you.
              </h1>
              <p className="mt-4 max-w-[460px] text-sm leading-relaxed text-[var(--muted)]">
                Aro reads your Finder selection, asks a model for a command, predicts side
                effects, and only runs after you approve unless you enable trusted auto-run
                categories.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className="rounded-[18px] border border-[var(--rule)] bg-white/[0.045] p-3">
                  <MousePointer2 size={16} className="text-[var(--accent-hot)]" />
                  <p className="mt-2 text-xs font-semibold">Control + Space</p>
                  <p className="mt-1 text-[10px] leading-snug text-[var(--muted)]">
                    Summon below Finder.
                  </p>
                </div>
                <div className="rounded-[18px] border border-[var(--rule)] bg-white/[0.045] p-3">
                  <FolderOpen size={16} className="text-[var(--accent-hot)]" />
                  <p className="mt-2 text-xs font-semibold">Finder aware</p>
                  <p className="mt-1 text-[10px] leading-snug text-[var(--muted)]">
                    Uses selected files.
                  </p>
                </div>
                <div className="rounded-[18px] border border-[var(--rule)] bg-white/[0.045] p-3">
                  <ShieldCheck size={16} className="text-[var(--accent-hot)]" />
                  <p className="mt-2 text-xs font-semibold">Preview first</p>
                  <p className="mt-1 text-[10px] leading-snug text-[var(--muted)]">
                    Review every risky command.
                  </p>
                </div>
              </div>
            </div>

            <div className="mx-auto flex h-[220px] w-[220px] items-center justify-center overflow-hidden rounded-[54px] border border-[var(--rule)] bg-white/[0.06] shadow-[0_28px_80px_rgba(32,18,42,0.34)]">
              <AroMark size={210} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex h-full flex-col">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent-hot)]">
              Permission setup
            </p>
            <h1 className="mt-3 text-2xl font-semibold">Let Aro see your Finder context.</h1>
            <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-[var(--muted)]">
              Click Check Finder. macOS may ask whether Aro can control Finder. Press Allow.
              Aro only uses this to read selected file paths and the current folder.
            </p>

            <div className="mt-6 rounded-[24px] border border-[var(--rule)] bg-white/[0.045] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <FolderOpen size={17} />
                    Finder Automation
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                    {finderState === "ok"
                      ? `Connected to ${finderContext?.current_directory || "Finder"}.`
                      : finderState === "blocked"
                        ? finderError || "Finder did not respond yet. Allow Aro in Automation, then check again."
                        : "Required for selected files and current folder."}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    finderState === "ok"
                      ? "border-[var(--success-rule)] bg-[var(--success-soft)] text-[var(--success)]"
                      : finderState === "blocked"
                        ? "border-[var(--warning-rule)] bg-[var(--warning-soft)] text-[var(--warning)]"
                        : "border-[var(--rule)] text-[var(--muted)]"
                  }`}
                >
                  {finderState === "checking"
                    ? "Checking"
                    : finderState === "ok"
                      ? "Connected"
                      : finderState === "blocked"
                        ? "Needs attention"
                        : "Not checked"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-full accent-fill px-4 text-xs font-semibold text-white shadow-[0_12px_34px_rgba(213,99,255,0.28)] disabled:opacity-50"
                  disabled={finderState === "checking"}
                  onClick={checkFinder}
                  type="button"
                >
                  <ShieldCheck size={14} />
                  {finderState === "checking" ? "Waiting for macOS" : "Check Finder"}
                </button>
                <button
                  className="h-10 rounded-full border border-[var(--rule)] px-4 text-xs text-[var(--ink-soft)] hover:bg-white/[0.08]"
                  onClick={() => openPrivacyPane("Automation")}
                  type="button"
                >
                  Open Automation
                </button>
                <button
                  className="h-10 rounded-full border border-[var(--rule)] px-4 text-xs text-[var(--ink-soft)] hover:bg-white/[0.08]"
                  onClick={() => openPrivacyPane("Accessibility")}
                  type="button"
                >
                  Accessibility
                </button>
                <button
                  className="h-10 rounded-full border border-[var(--rule)] px-4 text-xs text-[var(--ink-soft)] hover:bg-white/[0.08]"
                  onClick={() => openPrivacyPane("ListenEvent")}
                  type="button"
                >
                  Input Monitoring
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-[var(--warning-rule)] bg-[var(--warning-soft)] p-4 text-xs leading-relaxed text-[var(--warning)]">
              If Control + Space does not summon Aro, open Accessibility and Input Monitoring,
              enable Aro, then relaunch the app.
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex h-full flex-col">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent-hot)]">
              Model setup
            </p>
            <h1 className="mt-3 text-2xl font-semibold">Choose the model that writes commands.</h1>
            <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-[var(--muted)]">
              Pick a provider to continue. Grok, GPT, Gemini, and DeepSeek need an API key. Local
              runs Gemma or any OpenAI-compatible model through Ollama with no token.
            </p>

            <div className="mt-5 grid grid-cols-6 gap-2">
              {PROVIDERS.map((provider) => {
                const selected = draft.providerChosen && provider.id === draft.activeProvider;
                return (
                  <button
                    className={`min-h-[80px] rounded-[20px] border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                      selected
                        ? "border-[var(--accent-rule)] bg-[var(--accent-soft)]"
                        : "border-[var(--rule)] bg-white/[0.045] text-[var(--muted)] hover:bg-white/[0.07] hover:text-[var(--ink)]"
                    }`}
                    key={provider.id}
                    onClick={() => selectProvider(provider.id)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                      {provider.shortName}
                      {selected && <Check size={14} />}
                    </span>
                    <span className="mt-1 block text-[10px] leading-snug opacity-80">
                      {provider.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {!draft.providerChosen && (
              <div className="mt-4 rounded-[22px] border border-dashed border-[var(--rule)] bg-white/[0.025] p-4 text-xs leading-relaxed text-[var(--muted)]">
                Pick one of the six providers above. Aro will not pick one for you.
              </div>
            )}

            {draft.providerChosen && (
            <div className="mt-4 rounded-[24px] border border-[var(--rule)] bg-white/[0.045] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound size={16} />
                  {activeProvider.name} key and model
                </p>
                {activeProvider.consoleUrl && (
                  <button
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--rule)] px-3 text-[11px] text-[var(--muted)] hover:bg-white/[0.08] hover:text-[var(--ink)]"
                    onClick={() => void openUrl(activeProvider.consoleUrl!)}
                    type="button"
                  >
                    Console
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-[1fr_1fr] gap-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-[var(--muted)]">
                    {activeProvider.apiKeyLabel}
                  </span>
                  <input
                    className="h-11 w-full rounded-[18px] border border-[var(--rule)] bg-black/10 px-3 text-sm outline-none placeholder:text-[var(--faint)] disabled:opacity-55 focus:border-[var(--accent)]"
                    disabled={!canEditApiKey}
                    onChange={(event) =>
                      updateProvider(activeProvider.id, { apiKey: event.target.value })
                    }
                    placeholder={activeProvider.apiKeyPlaceholder}
                    type="password"
                    value={canEditApiKey ? activeCredentials.apiKey : ""}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] text-[var(--muted)]">Model</span>
                  <input
                    className="h-11 w-full rounded-[18px] border border-[var(--rule)] bg-black/10 px-3 font-mono text-[12px] outline-none focus:border-[var(--accent)]"
                    list={`onboarding-${activeProvider.id}-models`}
                    onChange={(event) =>
                      updateProvider(activeProvider.id, { model: event.target.value })
                    }
                    value={activeCredentials.model}
                  />
                  <datalist id={`onboarding-${activeProvider.id}-models`}>
                    {activeProvider.modelOptions.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                </label>
              </div>

              <label className="mt-3 block">
                <span className="mb-1 block text-[11px] text-[var(--muted)]">Base URL</span>
                <input
                  className="h-10 w-full rounded-[16px] border border-[var(--rule)] bg-black/10 px-3 font-mono text-[11px] text-[var(--ink-soft)] outline-none disabled:opacity-55 focus:border-[var(--accent)]"
                  disabled={!activeProvider.baseUrlEditable}
                  onChange={(event) =>
                    updateProvider(activeProvider.id, { baseUrl: event.target.value })
                  }
                  value={activeCredentials.baseUrl}
                />
              </label>

              {activeProvider.id === "ollama" && (
                <p className="mt-2 text-[10px] leading-relaxed text-[var(--faint)]">
                  Local mode uses an OpenAI-compatible server. For Ollama, keep
                  http://localhost:11434/v1 and enter the exact model name from ollama list.
                </p>
              )}
            </div>
            )}

            {draft.providerChosen && !hasApiKey && (
              <p className="mt-3 text-xs text-[var(--warning)]">
                Paste an API key to continue. Aro needs it to talk to {activeProvider.name}.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex h-full flex-col">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent-hot)]">
              Safety defaults
            </p>
            <h1 className="mt-3 text-2xl font-semibold">Choose what can run smoothly.</h1>
            <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-[var(--muted)]">
              Aro always blocks silent delete, system, network, and unknown commands. Start with
              read-only auto-run, then loosen it later if you trust the workflow.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {AUTO_RUN_OPTIONS.map((option) => {
                const enabled = draft.autoRunCategories.includes(option.category);
                return (
                  <button
                    className={`min-h-[118px] rounded-[22px] border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                      enabled
                        ? "border-[var(--success-rule)] bg-[var(--success-soft)]"
                        : "border-[var(--rule)] bg-white/[0.045] text-[var(--muted)] hover:bg-white/[0.07] hover:text-[var(--ink)]"
                    }`}
                    key={option.category}
                    onClick={() => toggleAutoRun(option.category)}
                    type="button"
                  >
                    <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                      {option.label}
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                          enabled
                            ? "border-[var(--success-rule)] bg-[var(--success)] text-[#16121f]"
                            : "border-[var(--rule)]"
                        }`}
                      >
                        {enabled && <Check size={13} />}
                      </span>
                    </span>
                    <span className="mt-2 block text-[11px] leading-relaxed opacity-80">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[22px] border border-[var(--rule)] bg-black/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <LockKeyhole size={16} />
                What Aro will still ask about
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                Delete commands, sudo/system changes, downloads/network requests, and commands Aro
                cannot confidently classify will always show a confirmation preview.
              </p>
            </div>
          </div>
        )}

        <footer className="mt-auto flex items-center justify-between border-t border-[var(--rule)] pt-4">
          <button
            className="h-10 rounded-full px-4 text-xs text-[var(--muted)] transition hover:bg-white/[0.08] hover:text-[var(--ink)] disabled:opacity-35"
            disabled={step === 0}
            onClick={previousStep}
            type="button"
          >
            Back
          </button>

          {step < steps.length - 1 ? (
            <button
              className="inline-flex h-10 items-center gap-2 rounded-full accent-fill px-5 text-xs font-semibold text-white shadow-[0_12px_34px_rgba(213,99,255,0.28)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={step === 2 && !canContinueModelStep}
              onClick={nextStep}
              type="button"
            >
              Continue
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className="inline-flex h-10 items-center gap-2 rounded-full accent-fill px-5 text-xs font-semibold text-white shadow-[0_12px_34px_rgba(213,99,255,0.28)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canFinish}
              onClick={() => onComplete(draft)}
              type="button"
            >
              <Zap size={14} />
              Finish setup
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}
