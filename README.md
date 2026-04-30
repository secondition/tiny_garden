# Tiny Garden Windows

Windows desktop shell for the Google AI Edge Gallery Tiny Garden mini-game.

This project packages the upstream Tiny Garden web game assets in a Tauri 2 desktop
application and adds a Windows-friendly command bar. Commands are routed to a full Gemma
LiteRT-LM sidecar in WSL when available, with a deterministic parser as the bundled fallback.

## Requirements

- Windows with WebView2 Runtime
- Node.js and pnpm
- Rust stable MSVC toolchain
- Visual Studio 2022 Build Tools with Desktop development with C++

Check the local environment:

```powershell
pnpm exec tauri info
```

## Development

Install dependencies:

```powershell
pnpm install
```

Run the desktop app in development mode:

```powershell
pnpm dev
```

Run formatting and static checks:

```powershell
pnpm format
pnpm check
```

Build the Windows executable and installers:

```powershell
pnpm build
```

The release executable is produced at:

```text
src-tauri/target/release/tiny-garden-windows.exe
```

## Gemma Backend

The app can use a full Gemma LiteRT-LM model through WSL:

```powershell
.\scripts\setup-wsl-litertlm.ps1
```

See `docs/wsl-litertlm.md` for setup details and the sidecar JSON contract.

## Upstream Assets

Tiny Garden game assets are vendored from
`google-ai-edge/gallery` under `Android/src/app/src/main/assets/tinygarden`.

The upstream project is licensed under Apache License 2.0. A copy is included at
`licenses/google-ai-edge-gallery.Apache-2.0.txt`.
