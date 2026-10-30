mod backup;
mod categories;
mod completions;
mod database;
mod error;
mod library;
mod schedule;
mod settings;
mod state;
mod tasks;
mod urgency;

use error::Result;
use state::Store;
use tauri::Manager;
use tauri::State;

#[tauri::command]
fn list_tasks(store: State<Store>) -> Result<tasks::TaskList> {
    store.with(|c| tasks::list(c, chrono::Local::now().date_naive()))
}
#[tauri::command]
fn save_task(store: State<Store>, input: tasks::TaskInput) -> Result<i64> {
    store.with(|c| tasks::save(c, &input, chrono::Local::now().date_naive()))
}
#[tauri::command]
fn delete_task(store: State<Store>, id: i64) -> Result<()> {
    store.with(|c| tasks::delete(c, id))
}
#[tauri::command]
fn list_categories(store: State<Store>) -> Result<Vec<categories::Category>> {
    store.with(|c| categories::list(c))
}
#[tauri::command]
fn save_category(store: State<Store>, id: Option<i64>, name: String) -> Result<i64> {
    store.with(|c| categories::save(c, id, &name))
}
#[tauri::command]
fn delete_category(store: State<Store>, id: i64, move_to: i64) -> Result<()> {
    store.with(|c| categories::delete(c, id, move_to))
}
#[tauri::command]
fn get_display(store: State<Store>) -> Result<String> {
    store.with(|c| settings::display(c))
}
#[tauri::command]
fn set_display(store: State<Store>, value: String) -> Result<()> {
    store.with(|c| settings::set_display(c, &value))
}

#[tauri::command]
fn list_completions(store: State<Store>, task_id: i64) -> Result<Vec<completions::Completion>> {
    store.with(|c| completions::list(c, task_id))
}
#[tauri::command]
fn record_completion(
    store: State<Store>,
    task_id: i64,
    completed_on: String,
) -> Result<completions::Recorded> {
    store
        .with(|c| completions::record(c, task_id, &completed_on, chrono::Local::now().date_naive()))
}
#[tauri::command]
fn update_completion(store: State<Store>, id: i64, completed_on: String) -> Result<()> {
    store.with(|c| completions::update(c, id, &completed_on, chrono::Local::now().date_naive()))
}
#[tauri::command]
fn delete_completion(store: State<Store>, id: i64) -> Result<()> {
    store.with(|c| completions::delete(c, id, chrono::Local::now().date_naive()))
}

#[tauri::command]
fn add_templates(store: State<Store>, selected: Vec<library::Selection>) -> Result<Vec<i64>> {
    store.with(|c| library::add(c, selected, chrono::Local::now().date_naive()))
}

#[tauri::command]
fn export_backup(store: State<Store>, path: String) -> Result<()> {
    store.with(|c| {
        backup::export(
            c,
            std::path::Path::new(&path),
            &store.directory.join("homebase.db"),
        )
    })
}
#[tauri::command]
fn restore_backup(store: State<Store>, path: String) -> Result<String> {
    store.with(|c| {
        backup::restore(
            c,
            std::path::Path::new(&path),
            &store.directory,
            chrono::Local::now().date_naive(),
        )
        .map(|p| p.to_string_lossy().to_string())
    })
}
#[tauri::command]
fn get_data_directory(store: State<Store>) -> String {
    store.directory.to_string_lossy().to_string()
}
#[tauri::command]
fn open_data_directory(store: State<Store>) -> Result<()> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(&store.directory)
            .spawn()?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = store;
        Err(error::AppError::invalid(
            "Opening the data folder is available on Windows.",
        ))
    }
}

#[tauri::command]
fn snooze_task(store: State<Store>, id: i64, until: Option<String>) -> Result<()> {
    store.with(|c| urgency::snooze(c, id, until, chrono::Local::now().date_naive()))
}
#[tauri::command]
fn save_urgency_defaults(store: State<Store>, value: urgency::Defaults) -> Result<()> {
    store.with(|c| urgency::save_defaults(c, value))
}
#[tauri::command]
fn undo_completion(store: State<Store>, id: i64) -> Result<()> {
    store.with(|c| completions::undo(c, id, chrono::Local::now().date_naive()))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            snooze_task,
            save_urgency_defaults,
            undo_completion,
            list_tasks,
            save_task,
            delete_task,
            list_categories,
            save_category,
            delete_category,
            get_display,
            set_display,
            list_completions,
            record_completion,
            update_completion,
            delete_completion,
            add_templates,
            export_backup,
            restore_backup,
            get_data_directory,
            open_data_directory
        ])
        .setup(|app| {
            // A debug-only isolated data directory keeps UI checks out of personal data.
            #[cfg(debug_assertions)]
            let directory = std::env::var_os("HOMEBASE_DATA_DIR")
                .map(std::path::PathBuf::from)
                .unwrap_or(app.path().app_data_dir()?);
            #[cfg(not(debug_assertions))]
            let directory = app.path().app_data_dir()?;
            let connection = database::open(&directory.join("homebase.db"))
                .map_err(|e| std::io::Error::other(e.message))?;
            app.manage(state::Store {
                connection: std::sync::Mutex::new(connection),
                directory,
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Homebase could not start");
}
