mod database;
mod error;
mod schedule;
mod state;
mod tasks;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
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
