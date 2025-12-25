# Changelog

All notable changes to Zephyr API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/EXTREMOPHILARUM/zephyr-api/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/EXTREMOPHILARUM/zephyr-api/releases/tag/v0.1.0
