export type ProviderId = "grok" | "openai" | "gemini" | "deepseek" | "ollama" | "custom";

export type AutoRunCategory = "safe" | "creates_files" | "modifies_files";

export interface ProviderOption {
  id: ProviderId;
  name: string;
  shortName: string;
  description: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  baseUrl: string;
  baseUrlEditable?: boolean;
  defaultModel: string;
  apiKeyEditable?: boolean;
  modelOptions: string[];
  requiresApiKey: boolean;
  consoleUrl?: string;
}

export interface ProviderCredentials {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface PersonalizationSettings {
  alwaysAskBeforeDestructive: boolean;
  commandStyle: "careful" | "fast" | "verbose";
  customInstructions: string;
  learnedPreferences: string[];
  outputNaming: "same_folder" | "subfolder" | "ask";
}

export interface LlmSettings {
  activeProvider: ProviderId;
  providerChosen: boolean;
  providers: Record<ProviderId, ProviderCredentials>;
  autoRunCategories: AutoRunCategory[];
  personalization: PersonalizationSettings;
}

export const DEFAULT_PERSONALIZATION: PersonalizationSettings = {
  alwaysAskBeforeDestructive: true,
  commandStyle: "careful",
  customInstructions:
    "Prefer simple macOS built-in tools. Never overwrite originals unless I clearly ask. Use short, predictable file names.",
  learnedPreferences: [],
  outputNaming: "same_folder",
};

export const GROK_MODEL = "grok-4-1-fast-non-reasoning";

export const PROVIDERS: ProviderOption[] = [
  {
    id: "grok",
    name: "Grok",
    shortName: "Grok",
    description: "Default Aro mode. Fast, direct, and tuned for file actions.",
    apiKeyLabel: "xAI API key",
    apiKeyPlaceholder: "xai-...",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: GROK_MODEL,
    modelOptions: [
      GROK_MODEL,
      "grok-4-1-fast-non-reasoning-latest",
      "grok-4-1-fast",
      "grok-code-fast-1",
    ],
    requiresApiKey: true,
    consoleUrl: "https://console.x.ai/",
  },
  {
    id: "openai",
    name: "OpenAI",
    shortName: "GPT",
    description: "Good for careful command planning and natural clarification.",
    apiKeyLabel: "OpenAI API key",
    apiKeyPlaceholder: "sk-...",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1",
    modelOptions: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"],
    requiresApiKey: true,
    consoleUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "gemini",
    name: "Gemini",
    shortName: "Gemini",
    description: "Uses Gemini's OpenAI-compatible endpoint for the same command flow.",
    apiKeyLabel: "Gemini API key",
    apiKeyPlaceholder: "AIza...",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-3-flash-preview",
    modelOptions: ["gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-pro"],
    requiresApiKey: true,
    consoleUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    shortName: "DeepSeek",
    description: "OpenAI-compatible DeepSeek chat and coding models.",
    apiKeyLabel: "DeepSeek API key",
    apiKeyPlaceholder: "sk-...",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    modelOptions: ["deepseek-chat", "deepseek-reasoner"],
    requiresApiKey: true,
    consoleUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "ollama",
    name: "Local model",
    shortName: "Local",
    description: "Use Gemma or other models on this Mac. No API token.",
    apiKeyLabel: "API key",
    apiKeyPlaceholder: "not needed for local models",
    baseUrl: "http://localhost:11434/v1",
    baseUrlEditable: true,
    apiKeyEditable: false,
    defaultModel: "gemma3:4b",
    modelOptions: [
      "gemma3:4b",
      "gemma3:1b",
      "gemma2:2b",
      "gemma2:9b",
      "llama3.2",
      "qwen2.5-coder",
    ],
    requiresApiKey: false,
  },
  {
    id: "custom",
    name: "Custom",
    shortName: "Custom",
    description: "Any OpenAI-compatible server, local or hosted.",
    apiKeyLabel: "API key",
    apiKeyPlaceholder: "optional, for hosted custom servers",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    modelOptions: ["llama3.2", "qwen2.5-coder", "deepseek-coder"],
    requiresApiKey: false,
    apiKeyEditable: true,
    baseUrlEditable: true,
  },
];

export const AUTO_RUN_OPTIONS: Array<{
  category: AutoRunCategory;
  label: string;
  description: string;
}> = [
  {
    category: "safe",
    label: "Read-only commands",
    description: "Run ls, file, wc, mdls, stat and similar inspection commands instantly.",
  },
  {
    category: "creates_files",
    label: "Create or convert files",
    description: "Run zip, copy, export and conversion commands after prediction.",
  },
  {
    category: "modifies_files",
    label: "Rename or move files",
    description: "Run mv-style commands when Aro's preflight says paths exist.",
  },
];

export function providerById(id: ProviderId) {
  return PROVIDERS.find((provider) => provider.id === id) ?? PROVIDERS[0];
}

export function createDefaultLlmSettings(): LlmSettings {
  return {
    activeProvider: "grok",
    providerChosen: false,
    providers: Object.fromEntries(
      PROVIDERS.map((provider) => [
        provider.id,
        {
          apiKey: "",
          model: provider.defaultModel,
          baseUrl: provider.baseUrl,
        },
      ]),
    ) as Record<ProviderId, ProviderCredentials>,
    autoRunCategories: ["safe"],
    personalization: { ...DEFAULT_PERSONALIZATION },
  };
}

export function cloneLlmSettings(settings: LlmSettings): LlmSettings {
  const defaults = createDefaultLlmSettings();

  return {
    activeProvider: settings.activeProvider,
    providerChosen: settings.providerChosen ?? false,
    providers: Object.fromEntries(
      PROVIDERS.map((provider) => [
        provider.id,
        {
          ...(settings.providers[provider.id] ?? defaults.providers[provider.id]),
        },
      ]),
    ) as Record<ProviderId, ProviderCredentials>,
    autoRunCategories: [...settings.autoRunCategories],
    personalization: {
      ...DEFAULT_PERSONALIZATION,
      ...(settings.personalization ?? {}),
      learnedPreferences: [
        ...((settings.personalization?.learnedPreferences ?? DEFAULT_PERSONALIZATION.learnedPreferences).slice(0, 12)),
      ],
    },
  };
}

export function normalizeLlmSettings(
  storedSettings: unknown,
  legacyGrokKey = "",
): LlmSettings {
  const defaults = createDefaultLlmSettings();
  const stored =
    storedSettings && typeof storedSettings === "object"
      ? (storedSettings as Partial<LlmSettings>)
      : {};

  const activeProvider = PROVIDERS.some((provider) => provider.id === stored.activeProvider)
    ? stored.activeProvider!
    : defaults.activeProvider;

  const storedProviders =
    stored.providers && typeof stored.providers === "object" ? stored.providers : {};

  const providers = Object.fromEntries(
    PROVIDERS.map((provider) => {
      const saved = (storedProviders as Partial<Record<ProviderId, Partial<ProviderCredentials>>>)[
        provider.id
      ];

      return [
        provider.id,
        {
          apiKey:
            saved?.apiKey ??
            (provider.id === "grok" && legacyGrokKey ? legacyGrokKey : defaults.providers[provider.id].apiKey),
          model: saved?.model || defaults.providers[provider.id].model,
          baseUrl: saved?.baseUrl || defaults.providers[provider.id].baseUrl,
        },
      ];
    }),
  ) as Record<ProviderId, ProviderCredentials>;

  const autoRunCategories = Array.isArray(stored.autoRunCategories)
    ? stored.autoRunCategories.filter((category): category is AutoRunCategory =>
        AUTO_RUN_OPTIONS.some((option) => option.category === category),
      )
    : defaults.autoRunCategories;

  const storedPersonalization =
    stored.personalization && typeof stored.personalization === "object"
      ? (stored.personalization as Partial<PersonalizationSettings>)
      : {};

  const commandStyle = ["careful", "fast", "verbose"].includes(
    storedPersonalization.commandStyle ?? "",
  )
    ? storedPersonalization.commandStyle!
    : defaults.personalization.commandStyle;

  const outputNaming = ["same_folder", "subfolder", "ask"].includes(
    storedPersonalization.outputNaming ?? "",
  )
    ? storedPersonalization.outputNaming!
    : defaults.personalization.outputNaming;

  const learnedPreferences = Array.isArray(storedPersonalization.learnedPreferences)
    ? storedPersonalization.learnedPreferences
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim())
        .slice(0, 12)
    : defaults.personalization.learnedPreferences;

  return {
    activeProvider,
    providerChosen: Boolean(stored.providerChosen),
    providers,
    autoRunCategories,
    personalization: {
      alwaysAskBeforeDestructive:
        storedPersonalization.alwaysAskBeforeDestructive ??
        defaults.personalization.alwaysAskBeforeDestructive,
      commandStyle,
      customInstructions:
        typeof storedPersonalization.customInstructions === "string"
          ? storedPersonalization.customInstructions
          : defaults.personalization.customInstructions,
      learnedPreferences,
      outputNaming,
    },
  };
}

export function getActiveProviderSettings(settings: LlmSettings) {
  const provider = providerById(settings.activeProvider);
  const credentials = settings.providers[provider.id] ?? createDefaultLlmSettings().providers[provider.id];

  return {
    provider,
    credentials,
  };
}
