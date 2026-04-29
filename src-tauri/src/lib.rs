use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EngineStatus {
    active_engine: &'static str,
    wsl_available: bool,
    litert_lm_cli_available: bool,
    python_pip_available: bool,
    notes: Vec<String>,
}

#[tauri::command]
fn engine_status() -> EngineStatus {
    let wsl_available = command_succeeds("wsl.exe", &["--status"]);
    let litert_lm_cli_available =
        wsl_available && command_succeeds("wsl.exe", &["bash", "-lc", "command -v litertlm"]);
    let python_pip_available =
        wsl_available && command_succeeds("wsl.exe", &["bash", "-lc", "python3 -m pip --version"]);

    let mut notes = vec!["当前使用规则解析；LiteRT-LM 后端尚未连接。".to_string()];
    if !wsl_available {
        notes.push("未检测到 WSL，LiteRT-LM CLI 的 Windows 路径不可用。".to_string());
    } else if !litert_lm_cli_available {
        notes.push("检测到 WSL，但未检测到 litertlm CLI。".to_string());
    }
    if wsl_available && !python_pip_available {
        notes.push("WSL Python 缺少 pip，暂不能安装 Python sidecar 依赖。".to_string());
    }

    EngineStatus {
        active_engine: "rules",
        wsl_available,
        litert_lm_cli_available,
        python_pip_available,
        notes,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![engine_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn command_succeeds(program: &str, args: &[&str]) -> bool {
    Command::new(program)
        .args(args)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}
