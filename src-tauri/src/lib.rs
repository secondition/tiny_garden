use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

const ENGINE_CHECK_TIMEOUT: Duration = Duration::from_millis(1200);
const GEMMA_REQUEST_TIMEOUT: Duration = Duration::from_secs(90);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EngineStatus {
    active_engine: &'static str,
    wsl_available: bool,
    litert_lm_cli_available: bool,
    python_pip_available: bool,
    sidecar_available: bool,
    notes: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GemmaCommandRequest {
    instruction: String,
}

#[derive(Serialize, Deserialize)]
struct GemmaGardenCommand {
    item: u8,
    plot: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GemmaCommandResponse {
    ok: bool,
    text: String,
    commands: Vec<GemmaGardenCommand>,
    engine: &'static str,
    error: Option<String>,
}

#[derive(Deserialize)]
struct SidecarCommandResponse {
    ok: bool,
    text: Option<String>,
    commands: Option<Vec<GemmaGardenCommand>>,
    error: Option<String>,
}

#[tauri::command]
async fn engine_status() -> EngineStatus {
    tauri::async_runtime::spawn_blocking(compute_engine_status)
        .await
        .unwrap_or_else(|_| EngineStatus {
            active_engine: "rules",
            wsl_available: false,
            litert_lm_cli_available: false,
            python_pip_available: false,
            sidecar_available: false,
            notes: vec!["Engine diagnostics failed; using rules parser.".to_string()],
        })
}

#[tauri::command]
async fn gemma_command(request: GemmaCommandRequest) -> GemmaCommandResponse {
    tauri::async_runtime::spawn_blocking(move || run_gemma_command(request))
        .await
        .unwrap_or_else(|_| GemmaCommandResponse {
            ok: false,
            text: String::new(),
            commands: Vec::new(),
            engine: "gemma-wsl",
            error: Some("Gemma sidecar task failed.".to_string()),
        })
}

fn compute_engine_status() -> EngineStatus {
    let wsl_available = command_succeeds("wsl.exe", &["--status"]);
    let sidecar_available = wsl_available
        && command_succeeds(
            "wsl.exe",
            &[
                "bash",
                "-lc",
                "test -x ~/.cache/tiny-garden/.venv/bin/python",
            ],
        );
    let litert_lm_cli_available = sidecar_available
        && command_succeeds(
            "wsl.exe",
            &[
                "bash",
                "-lc",
                "~/.cache/tiny-garden/.venv/bin/python - <<'PY'\nimport litert_lm\nPY",
            ],
        );
    let python_pip_available =
        wsl_available && command_succeeds("wsl.exe", &["bash", "-lc", "python3 -m pip --version"]);

    let mut notes = vec!["Using rules parser until the WSL Gemma backend is ready.".to_string()];
    if !wsl_available {
        notes.push("WSL is not available, so the Gemma backend cannot start.".to_string());
    } else if !litert_lm_cli_available {
        notes.push(
            "WSL is available, but litert_lm is not installed in the sidecar venv.".to_string(),
        );
    }
    if wsl_available && !python_pip_available {
        notes.push(
            "WSL system Python does not expose pip; setup script will use a venv.".to_string(),
        );
    }

    EngineStatus {
        active_engine: if litert_lm_cli_available {
            "gemma-wsl"
        } else {
            "rules"
        },
        wsl_available,
        litert_lm_cli_available,
        python_pip_available,
        sidecar_available,
        notes,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![engine_status, gemma_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn run_gemma_command(request: GemmaCommandRequest) -> GemmaCommandResponse {
    let instruction = request.instruction.trim();
    if instruction.is_empty() {
        return GemmaCommandResponse {
            ok: false,
            text: String::new(),
            commands: Vec::new(),
            engine: "gemma-wsl",
            error: Some("Instruction is empty.".to_string()),
        };
    }

    let sidecar_path = match sidecar_wsl_path() {
        Ok(path) => path,
        Err(error) => {
            return GemmaCommandResponse {
                ok: false,
                text: String::new(),
                commands: Vec::new(),
                engine: "gemma-wsl",
                error: Some(error),
            };
        }
    };

    let input = serde_json::json!({ "instruction": instruction }).to_string();
    let shell_command = format!(
        "~/.cache/tiny-garden/.venv/bin/python {}",
        shell_quote(&sidecar_path)
    );

    let output = match command_with_input(
        "wsl.exe",
        &["bash", "-lc", &shell_command],
        input.as_bytes(),
        GEMMA_REQUEST_TIMEOUT,
    ) {
        Ok(output) => output,
        Err(error) => {
            return GemmaCommandResponse {
                ok: false,
                text: String::new(),
                commands: Vec::new(),
                engine: "gemma-wsl",
                error: Some(error),
            };
        }
    };

    match serde_json::from_slice::<SidecarCommandResponse>(&output) {
        Ok(response) => GemmaCommandResponse {
            ok: response.ok,
            text: response.text.unwrap_or_default(),
            commands: response.commands.unwrap_or_default(),
            engine: "gemma-wsl",
            error: response.error,
        },
        Err(error) => GemmaCommandResponse {
            ok: false,
            text: String::new(),
            commands: Vec::new(),
            engine: "gemma-wsl",
            error: Some(format!("Failed to parse Gemma sidecar output: {error}")),
        },
    }
}

fn command_succeeds(program: &str, args: &[&str]) -> bool {
    command_with_timeout(program, args, ENGINE_CHECK_TIMEOUT)
        .map(|status| status.success())
        .unwrap_or(false)
}

fn command_with_timeout(
    program: &str,
    args: &[&str],
    timeout: Duration,
) -> Result<std::process::ExitStatus, String> {
    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Failed to start {program}: {error}"))?;

    wait_for_child(&mut child, timeout)
}

fn command_with_input(
    program: &str,
    args: &[&str],
    input: &[u8],
    timeout: Duration,
) -> Result<Vec<u8>, String> {
    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Failed to start {program}: {error}"))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(input)
            .map_err(|error| format!("Failed to send request to sidecar: {error}"))?;
    }
    drop(child.stdin.take());

    let status = wait_for_child(&mut child, timeout)?;
    let output = child
        .wait_with_output()
        .map_err(|error| format!("Failed to read sidecar output: {error}"))?;

    if status.success() {
        Ok(output.stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            format!("Gemma sidecar exited with status {status}")
        } else {
            stderr
        })
    }
}

fn wait_for_child(
    child: &mut std::process::Child,
    timeout: Duration,
) -> Result<std::process::ExitStatus, String> {
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Ok(status),
            Ok(None) if Instant::now() < deadline => {
                thread::sleep(Duration::from_millis(25));
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Command timed out.".to_string());
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("Failed while waiting for command: {error}"));
            }
        }
    }
}

fn sidecar_wsl_path() -> Result<String, String> {
    let sidecar_path = workspace_file(["scripts", "gemma_garden_sidecar.py"]);
    windows_path_to_wsl_path(&sidecar_path)
}

fn workspace_file<const N: usize>(segments: [&str; N]) -> PathBuf {
    let workspace_root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri has a parent directory");
    segments
        .iter()
        .fold(workspace_root.to_path_buf(), |path, segment| {
            path.join(segment)
        })
}

fn windows_path_to_wsl_path(path: &Path) -> Result<String, String> {
    let path_string = path
        .canonicalize()
        .map_err(|error| format!("Failed to resolve {}: {error}", path.display()))?
        .to_string_lossy()
        .to_string();
    let output = Command::new("wsl.exe")
        .args(["wslpath", "-a", &path_string])
        .output()
        .map_err(|error| format!("Failed to convert sidecar path for WSL: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}
