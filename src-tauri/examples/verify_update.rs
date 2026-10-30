use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};

// Uses the same Minisign verification as the updater, without installing anything.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let artifact = std::env::args().nth(1).ok_or("Pass the installer path")?;
    let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json"))?;
    let encoded_key = config["plugins"]["updater"]["pubkey"]
        .as_str()
        .ok_or("Missing updater public key")?;
    let key_text = String::from_utf8(STANDARD.decode(encoded_key.trim())?)?;
    let signature_text = std::fs::read_to_string(format!("{artifact}.sig"))?;
    let signature_text = String::from_utf8(STANDARD.decode(signature_text.trim())?)?;
    PublicKey::decode(&key_text)?.verify(
        &std::fs::read(&artifact)?,
        &Signature::decode(&signature_text)?,
        true,
    )?;
    println!("Installer signature matches Homebase's embedded public key.");
    Ok(())
}
