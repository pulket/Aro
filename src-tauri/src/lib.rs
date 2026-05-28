use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};
#[cfg(desktop)]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

mod commands;

const TRAY_ID: &str = "aro";

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = commands::window::position_window_below_finder(&window);
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("aro:shown", ());
    }
}

fn hide_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);

        if is_visible {
            hide_main_window(app);
            return;
        }

        show_main_window(app);
    }
}

fn show_settings_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn install_tray(app: &tauri::App) -> tauri::Result<()> {
    let Some(icon) = app.default_window_icon().cloned() else {
        return Ok(());
    };

    let open_item = MenuItem::with_id(app, "open", "Open Aro", true, Some("Ctrl+Space"))?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings…", true, Some("Cmd+,"))?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Aro", true, Some("Cmd+Q"))?;
    let menu = Menu::with_items(
        app,
        &[&open_item, &settings_item, &separator, &quit_item],
    )?;

    TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Aro")
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().0.as_str() {
            "open" => show_main_window(app),
            "settings" => show_settings_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn spawn_finder_dot_poll(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut last: Option<bool> = None;
        loop {
            let frontmost =
                tauri::async_runtime::spawn_blocking(commands::window::is_finder_frontmost)
                    .await
                    .unwrap_or(false);
            if last != Some(frontmost) {
                if let Some(tray) = app.tray_by_id(TRAY_ID) {
                    let title = if frontmost { Some("•") } else { Some("") };
                    let _ = tray.set_title(title);
                    let tooltip = if frontmost {
                        "Aro · Finder ready"
                    } else {
                        "Aro"
                    };
                    let _ = tray.set_tooltip(Some(tooltip));
                }
                last = Some(frontmost);
            }
            tokio::time::sleep(Duration::from_secs(3)).await;
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_positioner::init())
        .invoke_handler(tauri::generate_handler![
            commands::finder::get_finder_context,
            commands::shell::execute_command,
            commands::grok::ask_grok,
            commands::grok::check_local_model_status,
            commands::predict::predict_side_effects,
            commands::window::position_main_window,
            commands::window::hide_main_window,
            commands::window::show_main_window,
            commands::window::show_settings_window,
            commands::window::hide_settings_window,
            commands::window::is_finder_frontmost,
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::ShortcutState;

                let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Space);
                let handler_shortcut = shortcut;

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, triggered_shortcut, event| {
                            if event.state() != ShortcutState::Pressed {
                                return;
                            }

                            if triggered_shortcut == &handler_shortcut {
                                toggle_main_window(app);
                            }
                        })
                        .build(),
                )?;

                app.global_shortcut().register(shortcut)?;
                install_tray(app)?;
                show_main_window(app.handle());

                let delayed_app = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(700)).await;
                    show_main_window(&delayed_app);
                });

                spawn_finder_dot_poll(app.handle().clone());
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
