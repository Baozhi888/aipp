#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod db;
mod api;
mod plugin;
mod window;

use tauri::{WindowBuilder, WindowUrl, GlobalShortcutManager, Manager, WindowEvent, CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu, RunEvent, AppHandle};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex as TokioMutex;
use crate::api::ai_api::{ask_ai, models};
use get_selected_text::get_selected_text;
use crate::api::llm_api::{fetch_model_list, get_llm_models, get_llm_provider_config, get_llm_providers, update_llm_provider, update_llm_provider_config};
use crate::db::system_db::SystemDatabase;
use crate::db::llm_db::LLMDatabase;
use crate::window::{create_ask_window, open_config_window};

struct AppState {
    selected_text: TokioMutex<String>,
}

#[derive(Serialize, Deserialize)]
struct Config {
    selected_text: String,
}

#[cfg(target_os = "macos")]
fn query_accessibility_permissions() -> bool {
    let trusted = macos_accessibility_client::accessibility::application_is_trusted_with_prompt();
    if trusted {
        print!("Application is totally trusted!");
    } else {
        print!("Application isn't trusted :(");
    }
    trusted
}

#[cfg(not(target_os = "macos"))]
fn query_accessibility_permissions() -> bool {
    return true;
}

#[tauri::command]
async fn get_selected() -> Result<String, String> {
    let result = get_selected_text().unwrap_or_default();
    println!("{:?}", result);
    Ok(result)
}

#[tauri::command]
async fn save_config(state: tauri::State<'_, AppState>, config: Config) -> Result<(), String> {
    let mut selected_text = state.selected_text.lock().await;
    *selected_text = config.selected_text;
    Ok(())
}

#[tauri::command]
async fn get_config(state: tauri::State<'_, AppState>) -> Result<Config, String> {
    let selected_text = state.selected_text.lock().await;
    Ok(Config {
        selected_text: selected_text.clone(),
    })
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let show = CustomMenuItem::new("show".to_string(), "Show");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_item(quit);
    let system_tray = SystemTray::new().with_menu(tray_menu);

    let system_db = SystemDatabase::new()?;
    let llm_db = LLMDatabase::new()?;
    system_db.create_table()?;
    llm_db.create_table()?;

    let app = tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(window) = app.get_window("main") {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    app.exit(0);
                }
                "show" => {
                    if let Some(window) = app.get_window("main") {
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                }
                _ => {}
            },
            _ => {}
        })
        .setup(|app| {
            let app_handle = app.handle();

            if app.get_window("main").is_none() {
                create_ask_window(&app_handle)
            }

            if !query_accessibility_permissions() {
                println!("Please grant accessibility permissions to the app")
            }

            Ok(())
        })
        .manage(AppState {
            selected_text: TokioMutex::new(String::new()),
        })
        .invoke_handler(tauri::generate_handler![
            ask_ai, models, get_selected, open_config_window,
            save_config, get_config,
            get_llm_providers, update_llm_provider,
            get_llm_provider_config, update_llm_provider_config,
            get_llm_models, fetch_model_list
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, e| match e {
        RunEvent::Ready => {
            let app_handle = app_handle.clone();
            // Register global shortcut
            app_handle.global_shortcut_manager().register("CmdOrCtrl+Shift+I", move || {
                println!("CmdOrCtrl+Shift+I pressed");

                let text = get_selected_text().unwrap_or_default();
                println!("Selected text : {}", text);
                let app_state = app_handle.state::<AppState>();
                let mut selected_text_guard = app_state.selected_text.blocking_lock();
                *selected_text_guard = text;

                if app_handle.get_window("ask").is_none() {
                    println!("Creating window");

                    create_ask_window(&app_handle)
                } else if let Some(window) = app_handle.get_window("ask") {
                    println!("Showing window");
                    if window.is_minimized().unwrap_or(false) {
                        window.unminimize().unwrap();
                    }
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
            }).expect("Failed to register global shortcut");
        }
        RunEvent::ExitRequested { api, .. } => {
            api.prevent_exit();
        }
        _ => {}
    });

    Ok(())
}