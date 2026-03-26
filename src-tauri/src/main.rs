// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub redis: RedisConfig,
    pub file: FileConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub www: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RedisConfig {
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
    pub tls: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileConfig {
    pub storage_path: String,
}

const CONFIG_FILE: &str = "config.json";

#[tauri::command]
fn check_initial_setup() -> bool {
    Path::new(CONFIG_FILE).exists()
}

#[tauri::command]
fn save_configuration(config: AppConfig) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(CONFIG_FILE, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_configuration() -> Result<AppConfig, String> {
    let content = fs::read_to_string(CONFIG_FILE).map_err(|e| e.to_string())?;
    let config: AppConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            check_initial_setup,
            save_configuration,
            get_configuration
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
