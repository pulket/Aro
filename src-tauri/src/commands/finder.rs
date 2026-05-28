use serde::Serialize;
use std::{
    fs,
    path::Path,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

#[derive(Serialize)]
pub struct FinderDirectoryItem {
    pub name: String,
    pub path: String,
    pub kind: String,
}

#[derive(Serialize)]
pub struct FinderContext {
    pub selected_files: Vec<String>,
    pub current_directory: String,
    pub directory_items: Vec<FinderDirectoryItem>,
}

fn run_osascript(script: &str, failure_context: &str) -> Result<String, String> {
    let mut child = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("{failure_context}: {error}"))?;

    let started_at = Instant::now();
    let timeout = Duration::from_millis(1_800);

    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if started_at.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!(
                    "{failure_context}: timed out waiting for Finder Automation permission"
                ));
            }
            Ok(None) => thread::sleep(Duration::from_millis(30)),
            Err(error) => return Err(format!("{failure_context}: {error}")),
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("{failure_context}: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("{failure_context}: osascript exited with {}", output.status)
        } else {
            format!("{failure_context}: {stderr}")
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn directory_items_for(path: &str) -> Vec<FinderDirectoryItem> {
    let directory = Path::new(path);
    let Ok(entries) = fs::read_dir(directory) else {
        return Vec::new();
    };

    let mut items: Vec<FinderDirectoryItem> = entries
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.starts_with('.') {
                return None;
            }

            let metadata = entry.metadata().ok();
            let kind = if metadata.as_ref().is_some_and(|metadata| metadata.is_dir()) {
                "folder"
            } else {
                "file"
            };

            Some(FinderDirectoryItem {
                name: file_name,
                path: entry.path().to_string_lossy().to_string(),
                kind: kind.to_string(),
            })
        })
        .take(80)
        .collect();

    items.sort_by(|a, b| {
        a.kind
            .cmp(&b.kind)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    items
}

#[tauri::command]
pub async fn get_finder_context() -> Result<FinderContext, String> {
    let selected_output = run_osascript(
        r#"
            tell application "Finder"
                set selectedItems to selection
                set filePaths to {}
                repeat with anItem in selectedItems
                    set end of filePaths to POSIX path of (anItem as alias)
                end repeat
                set AppleScript's text item delimiters to "||"
                return filePaths as text
            end tell
        "#,
        "Failed to read Finder selection",
    )?;

    let selected_files = if selected_output.is_empty() {
        Vec::new()
    } else {
        selected_output
            .split("||")
            .filter(|path| !path.trim().is_empty())
            .map(|path| path.trim().to_string())
            .collect()
    };

    let current_directory = run_osascript(
        r#"
            tell application "Finder"
                if (count of Finder windows) > 0 then
                    return POSIX path of (target of front Finder window as alias)
                else
                    return POSIX path of (path to desktop)
                end if
            end tell
        "#,
        "Failed to read Finder directory",
    )?;
    let directory_items = directory_items_for(&current_directory);

    Ok(FinderContext {
        selected_files,
        current_directory,
        directory_items,
    })
}
