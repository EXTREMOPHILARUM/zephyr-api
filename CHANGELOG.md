# Changelog

All notable changes to Zephyr API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2025-12-26

### Added
- **Request History** (#6): Automatic request history tracking with persistent storage
  - Stores last 100 API requests in localStorage
  - Collapsible sidebar UI (280px desktop, full-width mobile)
  - Toggle button in header with request count badge
  - Search/filter functionality (by URL or method)
  - Click-to-load: Restore any previous request to builder
  - Visual indicators:
    - Color-coded method badges (GET=blue, POST=green, PUT=orange, DELETE=red, PATCH=purple)
    - Status indicators (✓ green for success, ✗ red for error)
    - Relative timestamps ("2 min ago", "Today 3:45 PM")
    - Response duration and status code display
  - Clear all history button with confirmation dialog
  - Complete request snapshot (method, URL, headers, query params, body, bodyMode)
  - Response metadata (status code, duration, success flag)
  - Full dark mode support for all history UI elements
  - Mobile responsive with overlay design
- **Response Download/Export** (#5): Save API responses to files
  - Save file dialog for choosing download location
  - Multiple export formats:
    - JSON (body only or with full response metadata)
    - Text (body only or with headers/metadata)
  - Smart filename generation from URL and timestamp
  - File type filters in save dialog
  - Tauri dialog and filesystem plugins integration
  - Full dark mode support for download menu

### Fixed
- Download functionality now uses native save dialog instead of browser auto-download

### Technical Details
- History storage: localStorage with 100-entry FIFO queue
- File operations: Tauri dialog and fs plugins
- New dependencies: @tauri-apps/plugin-dialog, @tauri-apps/plugin-fs
- Permissions configured: dialog:allow-save, fs:allow-write-text-file

## [0.2.0] - 2025-12-26

### Added
- **Android Support**: Native Android app (ARM64 APK)
  - Automated APK builds in GitHub Actions
  - Proper APK signing with debug keystore
  - Multi-architecture support (ARM64, ARMv7, x86, x86_64)
  - Custom Zephyr API app icons for Android
  - Installation support for Android 7.0 (API 24) and above
- **iOS Support**: Native iOS app
  - iOS project generation and configuration
  - Xcode project with automatic code signing
  - Custom Zephyr API app icons for iOS
  - Support for iOS 13.0 and above
  - iOS Simulator builds for development and testing
- **Mobile-Optimized UI**:
  - Responsive design with mobile breakpoints (768px)
  - Touch-friendly controls with 48px minimum touch targets
  - Optimized layouts for small screens
  - Mobile-specific CSS improvements
  - Column-based layouts on mobile devices
- **Developer Experience**:
  - Ruby 3.4.8 and CocoaPods setup documentation
  - Android NDK configuration for CI/CD
  - Separate build jobs for desktop and mobile platforms
  - Comprehensive mobile development documentation
  - Updated README with mobile setup instructions

### Fixed
- Android APK installation errors with proper signing configuration
- iOS development team configuration for device builds
- Xcode developer tools path configuration
- Android NDK toolchain setup in GitHub Actions

### Changed
- Switched from OpenSSL to rustls-tls for better Android cross-compilation
- Restructured GitHub Actions workflow with separate desktop and mobile jobs
- Updated documentation with mobile platform requirements

### Technical Details
- Android: Minimum SDK 24 (Android 7.0), Target SDK 34
- iOS: Minimum iOS 13.0, built with Xcode 26.2
- Mobile builds use Tauri v2's native Android and iOS support
- CORS-free requests work on mobile platforms

## [0.1.0] - 2025-12-26

### Added
- Initial release of Zephyr API
- REST API testing interface with clean, modern UI
- HTTP method support: GET, POST, PUT, DELETE
- Query parameters builder with key-value pairs
- Custom headers builder for request customization
- Request body builder for POST/PUT requests with JSON support
- JSON response viewer with syntax highlighting
- Collapsible tree view for nested JSON structures
- Dark mode support with automatic system preference detection
- Response details display:
  - HTTP status codes with color-coded badges (2xx green, 3xx blue, 4xx orange, 5xx red)
  - Response headers table view
  - Request timing in milliseconds
  - Full request details (method, URL, headers, body)
- CORS-free API requests via Rust backend
- Cross-platform support: macOS (Universal), Windows, Linux (AppImage, deb)
- GitHub Actions CI/CD pipeline for automated releases
- Auto-updater support with JSON manifest generation

### Technical Details
- Built with Tauri v2, React 18, TypeScript, and Rust
- Uses reqwest for HTTP client functionality
- Vite for fast development and builds
- @uiw/react-json-view for JSON visualization

[Unreleased]: https://github.com/EXTREMOPHILARUM/zephyr-api/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/EXTREMOPHILARUM/zephyr-api/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/EXTREMOPHILARUM/zephyr-api/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/EXTREMOPHILARUM/zephyr-api/releases/tag/v0.1.0
