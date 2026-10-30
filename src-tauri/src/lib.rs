mod categories;
mod database;
mod error;
mod schedule;
mod settings;
mod state;
mod tasks;

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

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_tasks,
            save_task,
            delete_task,
            list_categories,
            save_category,
            delete_category,
            get_display,
            set_display
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
