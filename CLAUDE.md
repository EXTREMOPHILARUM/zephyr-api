# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Zephyr API** is a lightweight, cross-platform desktop application for testing and exploring REST APIs, built with Tauri v2, React, and TypeScript. It's an alternative to Postman/Insomnia with a focus on speed and simplicity.

### Key Features
- HTTP methods: GET, POST, PUT, DELETE
- Query parameters, custom headers, and request body builders (key-value forms)
- JSON response viewer with syntax highlighting and collapsible tree
- Response headers, status codes, and request timing display
- Request details showing exactly what was sent
- Dark mode support
- CORS-free requests (made from Rust backend, not browser)

## Architecture

### Frontend (React + TypeScript + Vite)
- **Entry point**: `src/main.tsx` renders `App.tsx` into the DOM
- **Main component**: `src/App.tsx` - Contains the entire API testing UI
- **Styling**: `src/App.css` - Plain CSS with dark mode support
- **Vite config**: `vite.config.ts` - Configured for Tauri with fixed port 1420, HMR on port 1421
- **TypeScript config**: `tsconfig.json` for app code, `tsconfig.node.json` for build tools

### Backend (Rust + Tauri)
- **Entry point**: `src-tauri/src/main.rs` calls `run()` from `lib.rs`
- **Application logic**: `src-tauri/src/lib.rs` - Contains:
  - `ApiResponse` struct for detailed response data (status, headers, body, timing)
  - `fetch_json` async command for making HTTP requests
  - `greet` command (example/legacy)
- **Tauri config**: `src-tauri/tauri.conf.json` - App metadata, build commands, window: 1200x800
- **Cargo manifest**: `src-tauri/Cargo.toml` - Dependencies: reqwest, tokio, serde, urlencoding

### Frontend-Backend Communication
- Frontend calls Rust using `invoke()` from `@tauri-apps/api/core`
- Backend exposes commands using `#[tauri::command]` macro
- Commands are registered in `tauri::Builder` via `.invoke_handler(tauri::generate_handler![command_name])`
- Main command: `invoke<ApiResponse>("fetch_json", { url, method, headers, queryParams, body })`

## Common Commands

### Development
```bash
npm run tauri dev
```
Runs both the Vite dev server (port 1420) and Tauri app in development mode with hot reload.

### Building
```bash
npm run build              # Build frontend only (TypeScript + Vite)
npm run tauri build        # Build complete desktop application bundle
```

### Frontend Only
```bash
npm run dev                # Run Vite dev server only (without Tauri)
npm run preview            # Preview production build
```

### Rust Backend
```bash
cd src-tauri
cargo build                # Build Rust code
cargo check                # Fast check without building
cargo test                 # Run tests
cargo clippy               # Lint Rust code
```

### Mobile Development (Android & iOS)

**Prerequisites:**
- **Android:** Android Studio with command line tools, Android SDK (API 24+), Java Development Kit
- **iOS:** Xcode 13+, CocoaPods, iOS 13.0+ deployment target

**Initial Setup:**
```bash
# Install CocoaPods (iOS - requires sudo)
sudo gem install cocoapods

# Install Android command line tools through Android Studio
# Settings → Appearance & Behavior → System Settings → Android SDK → SDK Tools

# Initialize mobile projects (run once)
npm run android:init        # Generate Android project in src-tauri/gen/android
npm run ios:init            # Generate iOS project in src-tauri/gen/ios
```

**Development:**
```bash
npm run android:dev         # Run on Android emulator/device with hot reload
npm run ios:dev             # Run on iOS simulator/device with hot reload
```

**Building:**
```bash
npm run android:build       # Build Android APK/AAB
npm run ios:build           # Build iOS app bundle
```

**Mobile-Specific Notes:**
- Mobile features are enabled in `Cargo.toml` with `tauri = { version = "2", features = ["mobile"] }`
- Android requires `INTERNET` and `ACCESS_NETWORK_STATE` permissions (configured in tauri.conf.json)
- iOS requires minimum system version 13.0 (configured in tauri.conf.json)
- UI is responsive with mobile breakpoints at 768px (see App.css mobile media query)
- Touch targets are minimum 44px for accessibility
- CORS-free requests work on mobile (major advantage over browser-based tools)

## Key Implementation Details

### HTTP Request Flow
1. User builds request in UI (method, URL, params, headers, body)
2. Frontend validates and calls `invoke("fetch_json", { ... })`
3. Rust backend:
   - Validates method and URL
   - Builds full URL with query parameters (URL-encoded)
   - Creates reqwest client with 30s timeout
   - Adds custom headers to request
   - Adds JSON body for POST/PUT
   - Measures request duration
   - Extracts status code and response headers
   - Parses JSON response body
   - Returns `ApiResponse` struct
4. Frontend displays response in collapsible sections

### Adding New Tauri Commands
1. Define command function in `src-tauri/src/lib.rs` with `#[tauri::command]` attribute
2. Add function name to `generate_handler![]` macro in the builder
3. Call from frontend using `invoke("command_name", { args })`

### Adding HTTP Methods
1. Update method validation array in `src-tauri/src/lib.rs`: `["GET", "POST", "PUT", "DELETE", "PATCH"]`
2. Add case to request builder match statement: `"PATCH" => client.patch(&full_url),`
3. Add option to method dropdown in `src/App.tsx`: `<option value="PATCH">PATCH</option>`
4. Update body logic if needed (currently POST/PUT get body)

### Modifying UI Layout
- Request builder sections use HTML `<details>` elements for collapsible UI
- Response sections also use `<details>` with first section `open` by default
- Key-value builders use dynamic arrays of `{key, value}` pairs
- CSS uses `.params-section`, `.details-tabs`, `.response-section` classes

### JSON Viewer Configuration
Uses `@uiw/react-json-view` library:
- `collapsed={2}` - Auto-collapse nested objects at depth 2
- `displayDataTypes={false}` - Hide type annotations
- `style={isDarkMode ? darkTheme : undefined}` - Dark mode theme

### Dependencies
**npm packages:**
- `@tauri-apps/api` - Tauri frontend API
- `@uiw/react-json-view` - JSON visualization component
- `react`, `react-dom` - UI framework
- `vite`, `typescript` - Build tools

**Cargo crates:**
- `tauri` - Desktop app framework
- `reqwest` (features: "json") - HTTP client
- `tokio` (features: "full") - Async runtime
- `serde`, `serde_json` - JSON serialization
- `urlencoding` - URL encoding for query params

## Testing Examples

**GET with query params:**
- URL: `https://api.github.com/search/repositories`
- Query: `q=tauri`, `sort=stars`, `order=desc`

**POST with body:**
- URL: `https://jsonplaceholder.typicode.com/posts`
- Body: `title=Test`, `body=Content`, `userId=1`

**Headers test:**
- URL: `https://httpbin.org/headers`
- Headers: `X-Custom=Value`

**Timing test:**
- URL: `https://httpbin.org/delay/2`
