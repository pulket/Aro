import type { FinderDirectoryItem } from "../types";

interface InstantAction {
  match: (
    input: string,
    files: string[],
    cwd: string,
    directoryItems: FinderDirectoryItem[],
  ) => boolean;
  getCommand: (
    input: string,
    files: string[],
    cwd: string,
    directoryItems: FinderDirectoryItem[],
  ) => string;
  description: string;
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function replaceExtension(path: string, extension: string) {
  return path.replace(/\.[^.\/]+$/, extension);
}

function dirname(path: string) {
  return path.replace(/\/+$/, "").replace(/\/[^/]*$/, "") || "/";
}

function normalizeInput(input: string) {
  return input
    .toLowerCase()
    .replace(/\boflder\b/g, "folder")
    .replace(/\bfodler\b/g, "folder")
    .replace(/\bfldr\b/g, "folder")
    .replace(/\biamges\b/g, "images")
    .replace(/\biamge\b/g, "image")
    .replace(/\bot\b/g, "to")
    .replace(/\bto\s+to\b/g, "to")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(value: string) {
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[.。]+$/g, "")
    .trim();
}

function nameAfterRenameSeparator(input: string) {
  const normalized = normalizeInput(input);
  const match = normalized.match(/\b(?:to|into|as)\b\s+(.+)$/);
  return match ? cleanName(match[1]) : "";
}

function explicitFolderRenameTarget(input: string) {
  const normalized = normalizeInput(input);

  if (!/\brename\b/.test(normalized)) return "";
  const refersToFolder =
    /\b(?:my|this|current)\s+(?:folder|directory|dir)\b/.test(normalized) ||
    /\brename\s+(?:folder|directory|dir)\s+\b(?:to|into|as)\b/.test(normalized);

  if (!refersToFolder) return "";

  return nameAfterRenameSeparator(input);
}

function currentFolderRenameTarget(input: string) {
  const normalized = normalizeInput(input);
  const explicitTarget = explicitFolderRenameTarget(input);

  if (explicitTarget) return explicitTarget;
  if (!/\brename\b/.test(normalized)) return "";

  const refersToCurrentFolder = /\brename\s+(?:this|it|current)\s+\b(?:to|into|as)\b/.test(
    normalized,
  );

  if (!refersToCurrentFolder) return "";

  return nameAfterRenameSeparator(input);
}

function namedItemRename(input: string) {
  const normalized = normalizeInput(input);
  const match = normalized.match(/\brename\s+(.+?)\s+\b(?:to|into|as)\b\s+(.+)$/);

  if (!match) return null;

  const source = cleanName(match[1].replace(/^(?:my|this|current)\s+/, ""));
  const target = cleanName(match[2]);

  if (!source || !target) return null;
  return { source, target };
}

function nameStem(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function normalizedName(value: string) {
  return cleanName(value).toLowerCase();
}

function isGenericSourceName(value: string) {
  return /^(?:the\s+)?(?:file|files|image|images|photo|photos|item|items|thing|things|stuff|selection|selected files?)$/.test(
    normalizedName(value),
  );
}

function resolveVisibleItem(source: string, directoryItems: FinderDirectoryItem[]) {
  if (isGenericSourceName(source)) return null;

  const sourceName = normalizedName(source);
  const matches = directoryItems.filter((item) => {
    const itemName = normalizedName(item.name);
    return itemName === sourceName || normalizedName(nameStem(item.name)) === sourceName;
  });

  return matches.length === 1 ? matches[0] : null;
}

function visibleItemHint(directoryItems: FinderDirectoryItem[]) {
  const names = directoryItems.slice(0, 5).map((item) => item.name);
  if (names.length === 0) return "";
  if (names.length === 1) return ` I can see ${names[0]}.`;
  return ` I can see ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}.`;
}

export function clarificationForAmbiguousRequest(
  input: string,
  files: string[],
  directoryItems: FinderDirectoryItem[],
) {
  const normalized = normalizeInput(input);
  if (!/\brename\b/.test(normalized) || files.length > 0) return "";

  const namedRename = namedItemRename(input);
  if (!namedRename) return "";

  if (isGenericSourceName(namedRename.source)) {
    return `Which exact file or folder should I rename?${visibleItemHint(directoryItems)}`;
  }

  if (!resolveVisibleItem(namedRename.source, directoryItems)) {
    return `I cannot see "${namedRename.source}" in the current Finder folder. Which exact item should I rename?${visibleItemHint(
      directoryItems,
    )}`;
  }

  return "";
}

function commandForRename(sourcePath: string, targetName: string) {
  const safeTargetName = cleanName(targetName);
  const parent = dirname(sourcePath);
  const targetPath = safeTargetName.startsWith("/")
    ? safeTargetName
    : `${parent}/${safeTargetName}`;

  return [
    `if [ -e ${shellQuote(targetPath)} ]; then`,
    `echo ${shellQuote(`Cannot rename: destination already exists: ${targetPath}`)} >&2; exit 1;`,
    "else",
    `mv ${shellQuote(sourcePath)} ${shellQuote(targetPath)};`,
    "fi",
  ].join(" ");
}

function renameCommand(
  input: string,
  files: string[],
  cwd: string,
  directoryItems: FinderDirectoryItem[],
) {
  const explicitFolderTarget = explicitFolderRenameTarget(input);
  if (explicitFolderTarget) {
    return commandForRename(cwd.replace(/\/+$/, ""), explicitFolderTarget);
  }

  const selectedTarget = nameAfterRenameSeparator(input);
  if (files.length === 1 && selectedTarget) {
    return commandForRename(files[0], selectedTarget);
  }

  const currentTarget = currentFolderRenameTarget(input);
  if (files.length === 0 && currentTarget) {
    return commandForRename(cwd.replace(/\/+$/, ""), currentTarget);
  }

  const namedRename = namedItemRename(input);
  if (files.length === 0 && namedRename) {
    const visibleItem = resolveVisibleItem(namedRename.source, directoryItems);
    if (!visibleItem) return "";
    return commandForRename(visibleItem.path, namedRename.target);
  }

  return "";
}

export const instantActions: InstantAction[] = [
  {
    match: (input, files, cwd, directoryItems) =>
      Boolean(renameCommand(input, files, cwd, directoryItems)),
    getCommand: (input, files, cwd, directoryItems) =>
      renameCommand(input, files, cwd, directoryItems),
    description: "Renames the selected item or current Finder folder without overwriting",
  },
  {
    match: (input, files) =>
      ["jpg", "jpeg", "make jpg", "make a jpg", "convert to jpg"].includes(
        input.toLowerCase(),
      ) && files.length > 0,
    getCommand: (_input, files) =>
      files
        .map(
          (file) =>
            `sips -s format jpeg ${shellQuote(file)} --out ${shellQuote(
              replaceExtension(file, ".jpg"),
            )}`,
        )
        .join(" && "),
    description: "Converts selected files to JPEG in the same folder",
  },
  {
    match: (input, files) =>
      ["png", "make png", "convert to png"].includes(input.toLowerCase()) &&
      files.length > 0,
    getCommand: (_input, files) =>
      files
        .map(
          (file) =>
            `sips -s format png ${shellQuote(file)} --out ${shellQuote(
              replaceExtension(file, ".png"),
            )}`,
        )
        .join(" && "),
    description: "Converts selected files to PNG in the same folder",
  },
  {
    match: (input, files) =>
      ["zip", "zip up", "zip these", "zip em up"].includes(input.toLowerCase()) &&
      files.length > 0,
    getCommand: (_input, files, cwd) => {
      const dirName = cwd.split("/").filter(Boolean).pop() ?? "archive";
      return `zip -j ${shellQuote(`${cwd.replace(/\/$/, "")}/${dirName}.zip`)} ${files
        .map(shellQuote)
        .join(" ")}`;
    },
    description: "Creates a flat zip archive from the selected files",
  },
  {
    match: (input, files) => ["unzip"].includes(input.toLowerCase()) && files.length > 0,
    getCommand: (_input, files) =>
      files
        .map((file) => `unzip ${shellQuote(file)} -d ${shellQuote(file.replace(/\.zip$/i, ""))}`)
        .join(" && "),
    description: "Extracts selected zip files into matching folders",
  },
  {
    match: (input, files) =>
      ["mp4", "convert to mp4"].includes(input.toLowerCase()) && files.length > 0,
    getCommand: (_input, files) =>
      files
        .map(
          (file) =>
            `ffmpeg -i ${shellQuote(file)} -c:v libx264 -c:a aac ${shellQuote(
              replaceExtension(file, ".mp4"),
            )}`,
        )
        .join(" && "),
    description: "Converts selected videos to MP4 with ffmpeg",
  },
  {
    match: (input) => ["word count", "wc"].includes(input.toLowerCase()),
    getCommand: (_input, files) =>
      files.length > 0
        ? `wc -w ${files.map(shellQuote).join(" ")}`
        : `echo ${shellQuote("No files selected")}`,
    description: "Counts words in the selected files",
  },
];

export function findInstantAction(
  input: string,
  files: string[],
  cwd: string,
  directoryItems: FinderDirectoryItem[] = [],
) {
  return instantActions.find((action) => action.match(input, files, cwd, directoryItems)) ?? null;
}
