use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize)]
pub struct CommandResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub success: bool,
    pub undo_command: Option<String>,
}

fn expand_working_dir(working_dir: &str) -> PathBuf {
    if working_dir == "~" {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home);
        }
    }

    PathBuf::from(working_dir)
}

fn split_shell_words(command: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut current = String::new();
    let mut chars = command.chars().peekable();
    let mut quote: Option<char> = None;

    while let Some(ch) = chars.next() {
        if let Some(active_quote) = quote {
            if ch == active_quote {
                quote = None;
            } else if ch == '\\' && active_quote == '"' {
                if let Some(next) = chars.next() {
                    current.push(next);
                }
            } else {
                current.push(ch);
            }
            continue;
        }

        match ch {
            '\'' | '"' => quote = Some(ch),
            '\\' => {
                if let Some(next) = chars.next() {
                    current.push(next);
                }
            }
            ';' | '|' => {
                if !current.is_empty() {
                    words.push(std::mem::take(&mut current));
                }
                words.push(ch.to_string());
            }
            '&' if chars.peek() == Some(&'&') => {
                let _ = chars.next();
                if !current.is_empty() {
                    words.push(std::mem::take(&mut current));
                }
                words.push("&&".to_string());
            }
            c if c.is_whitespace() => {
                if !current.is_empty() {
                    words.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(ch),
        }
    }

    if !current.is_empty() {
        words.push(current);
    }

    words
}

fn absolute_path(token: &str, cwd: &Path) -> Option<PathBuf> {
    if token.contains('$') || token.contains('*') || token.contains('?') {
        return None;
    }

    if token == "~" {
        return std::env::var_os("HOME").map(PathBuf::from);
    }

    if let Some(rest) = token.strip_prefix("~/") {
        return std::env::var_os("HOME").map(|home| PathBuf::from(home).join(rest));
    }

    let path = PathBuf::from(token);
    if path.is_absolute() {
        Some(path)
    } else {
        Some(cwd.join(path))
    }
}

fn clean_path_for_prefix(path: &Path) -> PathBuf {
    PathBuf::from(path.to_string_lossy().trim_end_matches('/'))
}

fn command_word_present(command: &str, word: &str) -> bool {
    command == word
        || command.starts_with(&format!("{word} "))
        || command.contains(&format!(" {word} "))
        || command.contains(&format!(";{word} "))
        || command.contains(&format!("|{word} "))
        || command.contains(&format!("&& {word} "))
}

fn refusal(stderr: impl Into<String>) -> CommandResult {
    CommandResult {
        stdout: String::new(),
        stderr: stderr.into(),
        exit_code: 1,
        success: false,
        undo_command: None,
    }
}

fn security_preflight(command: &str) -> Option<CommandResult> {
    let lower = command.to_lowercase();
    let blocked_tools = [
        "sudo",
        "diskutil",
        "launchctl",
        "pmset",
        "osascript",
        "dd",
        "mkfs",
        "shutdown",
        "reboot",
        "passwd",
    ];

    for tool in blocked_tools {
        if command_word_present(&lower, tool) {
            return Some(refusal(format!(
                "Refusing to run: `{tool}` is outside Aro's file-action safety boundary."
            )));
        }
    }

    if (command_word_present(&lower, "curl") || command_word_present(&lower, "wget"))
        && (lower.contains("| sh") || lower.contains("| bash") || lower.contains("| zsh"))
    {
        return Some(refusal(
            "Refusing to run: downloaded scripts piped into a shell are not allowed.",
        ));
    }

    if lower.contains("rm -rf /")
        || lower.contains("rm -fr /")
        || lower.contains("rm -r / ")
        || lower.trim() == "rm -rf"
    {
        return Some(refusal(
            "Refusing to run: broad recursive deletion is not allowed.",
        ));
    }

    None
}

fn preflight_mv(command: &str, cwd: &Path) -> Option<CommandResult> {
    let tokens = split_shell_words(command);
    let mut index = 0;

    while index < tokens.len() {
        if tokens[index] != "mv" {
            index += 1;
            continue;
        }

        let mut args = Vec::new();
        index += 1;

        while index < tokens.len() {
            let token = &tokens[index];
            if matches!(token.as_str(), ";" | "|" | "&&" | "||" | "then" | "else" | "fi") {
                break;
            }
            if token == "--" {
                index += 1;
                continue;
            }
            if token.starts_with('-') {
                index += 1;
                continue;
            }
            args.push(token.clone());
            index += 1;
        }

        if args.len() < 2 {
            continue;
        }

        let destination = match absolute_path(args.last().unwrap(), cwd) {
            Some(path) => path,
            None => continue,
        };
        let sources = &args[..args.len() - 1];

        if sources.len() > 1 && !destination.is_dir() {
            return Some(CommandResult {
                stdout: String::new(),
                stderr: format!(
                    "Refusing to run: mv has multiple sources, but destination is not an existing folder: {}",
                    destination.display()
                ),
                exit_code: 1,
                success: false,
                undo_command: None,
            });
        }

        if sources.len() == 1 {
            if let Some(parent) = destination.parent() {
                if !parent.exists() {
                    return Some(CommandResult {
                        stdout: String::new(),
                        stderr: format!(
                            "Refusing to run: destination folder does not exist: {}",
                            parent.display()
                        ),
                        exit_code: 1,
                        success: false,
                        undo_command: None,
                    });
                }
            }
        }

        for source_token in sources {
            let source = match absolute_path(source_token, cwd) {
                Some(path) => path,
                None => continue,
            };

            if !source.exists() {
                return Some(CommandResult {
                    stdout: String::new(),
                    stderr: format!(
                        "Refusing to run: source path does not exist: {}",
                        source.display()
                    ),
                    exit_code: 1,
                    success: false,
                    undo_command: None,
                });
            }

            let source_clean = clean_path_for_prefix(&source);
            let destination_clean = clean_path_for_prefix(&destination);
            if destination_clean != source_clean && destination_clean.starts_with(&source_clean) {
                return Some(CommandResult {
                    stdout: String::new(),
                    stderr: format!(
                        "Refusing to run: cannot move a folder into itself: {} -> {}",
                        source.display(),
                        destination.display()
                    ),
                    exit_code: 1,
                    success: false,
                    undo_command: None,
                });
            }
        }
    }

    None
}

fn shell_quote_path(path: &Path) -> String {
    format!("'{}'", path.to_string_lossy().replace('\'', "'\\''"))
}

fn undo_for_simple_mv(command: &str, cwd: &Path) -> Option<String> {
    let tokens = split_shell_words(command);

    if tokens.first().map(String::as_str) != Some("mv") {
        return None;
    }

    if tokens.iter().any(|token| matches!(token.as_str(), ";" | "|" | "&&" | "||")) {
        return None;
    }

    let args: Vec<&String> = tokens
        .iter()
        .skip(1)
        .filter(|token| token.as_str() != "--" && !token.starts_with('-'))
        .collect();

    if args.len() != 2 {
        return None;
    }

    let source = absolute_path(args[0], cwd)?;
    let destination = absolute_path(args[1], cwd)?;
    let final_destination = if destination.is_dir() {
        destination.join(source.file_name()?)
    } else {
        destination
    };

    Some(format!(
        "mv {} {}",
        shell_quote_path(&final_destination),
        shell_quote_path(&source)
    ))
}

#[tauri::command]
pub async fn execute_command(command: String, working_dir: String) -> Result<CommandResult, String> {
    let trimmed = command.trim();

    if trimmed.is_empty() {
        return Err("Cannot execute an empty command".to_string());
    }

    if trimmed.len() > 8_000 || trimmed.contains('\0') {
        return Err("Command is too large or contains invalid characters".to_string());
    }

    let cwd = expand_working_dir(working_dir.trim());

    if let Some(result) = security_preflight(trimmed) {
        return Ok(result);
    }

    if let Some(result) = preflight_mv(trimmed, &cwd) {
        return Ok(result);
    }

    let undo_command = undo_for_simple_mv(trimmed, &cwd);

    let output = Command::new("bash")
        .arg("-lc")
        .arg(trimmed)
        .current_dir(&cwd)
        .output()
        .map_err(|error| format!("Failed to execute command in {}: {error}", cwd.display()))?;

    Ok(CommandResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
        success: output.status.success(),
        undo_command: if output.status.success() {
            undo_command
        } else {
            None
        },
    })
}
