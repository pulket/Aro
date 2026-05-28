use std::{
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

use tauri::{LogicalPosition, Manager, WebviewWindow};

#[derive(Debug, Clone, Copy)]
struct FinderBounds {
    left: f64,
    top: f64,
    right: f64,
    bottom: f64,
}

impl FinderBounds {
    fn width(self) -> f64 {
        self.right - self.left
    }

    fn center_x(self) -> f64 {
        self.left + self.width() / 2.0
    }
}

fn parse_finder_bounds(raw: &str) -> Option<FinderBounds> {
    let values: Vec<f64> = raw
        .trim()
        .split(',')
        .filter_map(|value| value.trim().parse::<f64>().ok())
        .collect();

    if values.len() != 4 {
        return None;
    }

    Some(FinderBounds {
        left: values[0],
        top: values[1],
        right: values[2],
        bottom: values[3],
    })
}

fn front_finder_bounds() -> Result<Option<FinderBounds>, String> {
    let mut child = Command::new("osascript")
        .arg("-e")
        .arg(
            r#"tell application "Finder"
                if (count of Finder windows) > 0 then
                    set b to bounds of front Finder window
                    set oldDelimiters to AppleScript's text item delimiters
                    set AppleScript's text item delimiters to ","
                    set boundsText to b as text
                    set AppleScript's text item delimiters to oldDelimiters
                    return boundsText
                else
                    return ""
                end if
            end tell"#,
        )
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Unable to read Finder window position: {error}"))?;

    let started_at = Instant::now();
    let timeout = Duration::from_millis(450);

    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if started_at.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Ok(None);
            }
            Ok(None) => thread::sleep(Duration::from_millis(20)),
            Err(error) => return Err(format!("Unable to read Finder window position: {error}")),
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Unable to read Finder window position: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let raw = String::from_utf8_lossy(&output.stdout);
    Ok(parse_finder_bounds(&raw))
}

fn clamp(value: f64, minimum: f64, maximum: f64) -> f64 {
    value.max(minimum).min(maximum)
}

pub fn position_window_below_finder(window: &WebviewWindow) -> Result<(), String> {
    let finder_bounds = match front_finder_bounds() {
        Ok(Some(bounds)) => bounds,
        Ok(None) | Err(_) => {
            window.center().map_err(|error| error.to_string())?;
            return Ok(());
        }
    };

    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let window_size = window
        .outer_size()
        .map_err(|error| format!("Unable to read Aro size: {error}"))?
        .to_logical::<f64>(scale_factor);

    let monitors = window
        .available_monitors()
        .map_err(|error| format!("Unable to read monitors: {error}"))?;

    let finder_center_x = finder_bounds.center_x();
    let target_monitor = monitors
        .iter()
        .find(|monitor| {
            let work_area = monitor.work_area();
            let position = work_area
                .position
                .to_logical::<f64>(monitor.scale_factor());
            let size = work_area.size.to_logical::<f64>(monitor.scale_factor());

            finder_center_x >= position.x
                && finder_center_x <= position.x + size.width
                && finder_bounds.top >= position.y
                && finder_bounds.top <= position.y + size.height
        })
        .or_else(|| monitors.first())
        .ok_or_else(|| "No monitor available for Aro".to_string())?;

    let work_area = target_monitor.work_area();
    let work_position = work_area
        .position
        .to_logical::<f64>(target_monitor.scale_factor());
    let work_size = work_area.size.to_logical::<f64>(target_monitor.scale_factor());

    let margin = 10.0;
    let min_x = work_position.x + margin;
    let max_x = work_position.x + work_size.width - window_size.width - margin;
    let min_y = work_position.y + margin;
    let max_y = work_position.y + work_size.height - window_size.height - margin;

    let x = clamp(finder_center_x - window_size.width / 2.0, min_x, max_x);
    let below_y = finder_bounds.bottom + margin;
    let above_y = finder_bounds.top - window_size.height - margin;
    let y = if below_y <= max_y {
        below_y
    } else {
        clamp(above_y, min_y, max_y)
    };

    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|error| format!("Unable to position Aro: {error}"))?;

    Ok(())
}

#[tauri::command]
pub fn position_main_window(window: WebviewWindow) -> Result<(), String> {
    position_window_below_finder(&window)
}

#[tauri::command]
pub fn hide_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Aro main window is not available".to_string())?;

    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Aro main window is not available".to_string())?;

    window.show().map_err(|error| error.to_string())?;
    let _ = position_window_below_finder(&window);
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn show_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("settings")
        .ok_or_else(|| "Aro settings window is not available".to_string())?;

    window.show().map_err(|error| error.to_string())?;
    window.unminimize().ok();
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn hide_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("settings")
        .ok_or_else(|| "Aro settings window is not available".to_string())?;

    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn is_finder_frontmost() -> bool {
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(r#"tell application "System Events" to get name of first application process whose frontmost is true"#)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            name == "Finder"
        }
        _ => false,
    }
}
