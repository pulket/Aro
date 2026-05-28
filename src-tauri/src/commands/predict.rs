use serde::Serialize;

#[derive(Serialize)]
pub struct Prediction {
    pub category: String,
    pub description: String,
    pub risk_level: String,
    pub files_affected: Vec<String>,
}

fn command_contains(command: &str, needle: &str) -> bool {
    command == needle
        || command.starts_with(&format!("{needle} "))
        || command.contains(&format!(" {needle} "))
        || command.contains(&format!(";{needle} "))
        || command.contains(&format!("|{needle} "))
        || command.contains(&format!("&& {needle} "))
}

fn quoted_paths(command: &str) -> Vec<String> {
    let mut paths = Vec::new();
    let mut chars = command.char_indices().peekable();

    while let Some((_, ch)) = chars.next() {
        if ch != '"' && ch != '\'' {
            continue;
        }

        let quote = ch;
        let mut value = String::new();

        while let Some((_, inner)) = chars.next() {
            if inner == quote {
                break;
            }
            value.push(inner);
        }

        if value.starts_with('/') && !paths.contains(&value) {
            paths.push(value);
        }
    }

    paths
}

#[tauri::command]
pub async fn predict_side_effects(command: String) -> Result<Prediction, String> {
    let cmd_lower = command.to_lowercase();
    let files_affected = quoted_paths(&command);

    let (category, description, risk_level) =
        if command_contains(&cmd_lower, "rm") || command_contains(&cmd_lower, "trash") {
            ("deletes_files", "Deletes files or moves them to trash", "high")
        } else if command_contains(&cmd_lower, "sudo")
            || command_contains(&cmd_lower, "defaults")
            || command_contains(&cmd_lower, "launchctl")
            || command_contains(&cmd_lower, "pmset")
            || command_contains(&cmd_lower, "chmod")
            || command_contains(&cmd_lower, "chown")
        {
            ("system", "May change system or permission settings", "high")
        } else if command_contains(&cmd_lower, "mv")
            || cmd_lower.contains(">")
            || command_contains(&cmd_lower, "sed")
            || command_contains(&cmd_lower, "perl")
        {
            ("modifies_files", "May move, rename, or edit files", "medium")
        } else if command_contains(&cmd_lower, "curl")
            || command_contains(&cmd_lower, "wget")
            || command_contains(&cmd_lower, "brew")
            || command_contains(&cmd_lower, "ssh")
            || command_contains(&cmd_lower, "scp")
        {
            ("network", "Makes network requests or contacts another machine", "medium")
        } else if command_contains(&cmd_lower, "sips")
            || command_contains(&cmd_lower, "ffmpeg")
            || command_contains(&cmd_lower, "magick")
            || command_contains(&cmd_lower, "convert")
            || command_contains(&cmd_lower, "zip")
            || command_contains(&cmd_lower, "tar")
            || command_contains(&cmd_lower, "pandoc")
            || command_contains(&cmd_lower, "touch")
            || command_contains(&cmd_lower, "mkdir")
            || command_contains(&cmd_lower, "cp")
            || command_contains(&cmd_lower, "ditto")
        {
            ("creates_files", "Creates new files or folders", "low")
        } else if command_contains(&cmd_lower, "cat")
            || command_contains(&cmd_lower, "ls")
            || command_contains(&cmd_lower, "file")
            || command_contains(&cmd_lower, "mdls")
            || command_contains(&cmd_lower, "wc")
            || command_contains(&cmd_lower, "echo")
            || command_contains(&cmd_lower, "stat")
            || command_contains(&cmd_lower, "du")
            || command_contains(&cmd_lower, "find")
        {
            ("safe", "Reads information without changing files", "low")
        } else {
            (
                "unknown",
                "Could not fully predict side effects; review carefully",
                "medium",
            )
        };

    Ok(Prediction {
        category: category.to_string(),
        description: description.to_string(),
        risk_level: risk_level.to_string(),
        files_affected,
    })
}
