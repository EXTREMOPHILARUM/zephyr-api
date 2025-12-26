import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";
import "./App.css";

type ThemeMode = "auto" | "light" | "dark";
type KeyValuePair = { key: string; value: string };

type ApiResponse = {
  status_code: number;
  headers: Record<string, string>;
  body: any;
  duration_ms: number;
};

type RequestDetails = {
  method: string;
  url: string;
  headers: Record<string, string>;
  queryParams: [string, string][];
  body: any;
};

interface HistoryEntry {
  id: string;
  timestamp: number;
  request: {
    method: string;
    url: string;
    baseUrl: string;
    headers: Array<{ key: string; value: string }>;
    queryParams: Array<{ key: string; value: string }>;
    bodyMode: 'form' | 'raw';
    bodyParams: Array<{ key: string; value: string }>;
    rawJsonBody: string;
  };
  response: {
    status: number;
    duration: number;
    success: boolean;
  };
}

// Load history from localStorage
const loadHistory = (): HistoryEntry[] => {
  try {
    const stored = localStorage.getItem('zephyr_request_history');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load history:', error);
    return [];
  }
};

// Save history to localStorage
const saveHistory = (entries: HistoryEntry[]) => {
  try {
    localStorage.setItem('zephyr_request_history', JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to save history:', error);
  }
};

function App() {
  const [apiUrl, setApiUrl] = useState<string>("");
  const [method, setMethod] = useState<string>("GET");
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>([
    { key: "", value: "" },
  ]);
  const [headers, setHeaders] = useState<KeyValuePair[]>([
    { key: "", value: "" },
  ]);
  const [bodyParams, setBodyParams] = useState<KeyValuePair[]>([
    { key: "", value: "" },
  ]);
  const [bodyMode, setBodyMode] = useState<"form" | "raw">("form");
  const [rawJsonBody, setRawJsonBody] = useState<string>("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [requestActiveTab, setRequestActiveTab] = useState<string>("query");
  const [responseActiveTab, setResponseActiveTab] = useState<string>("body");
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory());
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState<boolean>(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Close download menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false);
      }
    };

    if (showDownloadMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDownloadMenu]);

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme-mode") as ThemeMode | null;
    if (savedTheme && ["auto", "light", "dark"].includes(savedTheme)) {
      setThemeMode(savedTheme);
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Determine actual dark mode based on theme preference
  const isDarkMode =
    themeMode === "dark" ? true :
    themeMode === "light" ? false :
    systemPrefersDark; // auto mode

  // Apply theme to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, [isDarkMode]);

  // Toggle theme mode
  const cycleTheme = () => {
    const modes: ThemeMode[] = ["auto", "light", "dark"];
    const currentIndex = modes.indexOf(themeMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setThemeMode(nextMode);
    localStorage.setItem("theme-mode", nextMode);
  };

  // Auto-switch tab when Request Body becomes unavailable
  useEffect(() => {
    if (requestActiveTab === "body" &&
        method !== "POST" && method !== "PUT" && method !== "PATCH") {
      setRequestActiveTab("query");
    }
  }, [method, requestActiveTab]);

  // Keyboard navigation for Request Builder tabs
  const handleRequestTabKeyDown = (e: React.KeyboardEvent) => {
    const tabs = ["query", "headers"];
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      tabs.push("body");
    }
    const currentIndex = tabs.indexOf(requestActiveTab);

    if (e.key === "ArrowRight") {
      e.preventDefault();
      setRequestActiveTab(tabs[(currentIndex + 1) % tabs.length]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setRequestActiveTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
    }
  };

  // Keyboard navigation for Response tabs
  const handleResponseTabKeyDown = (e: React.KeyboardEvent) => {
    const tabs = ["body", "headers", "details"];
    const currentIndex = tabs.indexOf(responseActiveTab);

    if (e.key === "ArrowRight") {
      e.preventDefault();
      setResponseActiveTab(tabs[(currentIndex + 1) % tabs.length]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setResponseActiveTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
    }
  };

  const addQueryParam = () => {
    setQueryParams([...queryParams, { key: "", value: "" }]);
  };

  const removeQueryParam = (index: number) => {
    setQueryParams(queryParams.filter((_, i) => i !== index));
  };

  const updateQueryParam = (index: number, field: "key" | "value", value: string) => {
    const updated = [...queryParams];
    updated[index][field] = value;
    setQueryParams(updated);
  };

  const addHeader = () => {
    setHeaders([...headers, { key: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: "key" | "value", value: string) => {
    const updated = [...headers];
    updated[index][field] = value;
    setHeaders(updated);
  };

  const addBodyParam = () => {
    setBodyParams([...bodyParams, { key: "", value: "" }]);
  };

  const removeBodyParam = (index: number) => {
    setBodyParams(bodyParams.filter((_, i) => i !== index));
  };

  const updateBodyParam = (index: number, field: "key" | "value", value: string) => {
    const updated = [...bodyParams];
    updated[index][field] = value;
    setBodyParams(updated);
  };

  // Generate filename from URL and timestamp
  const generateFilename = (extension: string): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let urlPart = "response";

    if (apiUrl) {
      try {
        const url = new URL(apiUrl);
        urlPart = url.hostname.replace(/\./g, "-") + url.pathname.replace(/\//g, "-");
        urlPart = urlPart.replace(/[^a-zA-Z0-9-]/g, "").substring(0, 50);
      } catch {
        urlPart = apiUrl.substring(0, 30).replace(/[^a-zA-Z0-9-]/g, "-");
      }
    }

    return `${urlPart}-${timestamp}.${extension}`;
  };

  // Download response as JSON
  const downloadAsJson = async (includeHeaders: boolean = false) => {
    if (!response) return;

    const data = includeHeaders ? {
      statusCode: response.status_code,
      headers: response.headers,
      body: response.body,
      durationMs: response.duration_ms
    } : response.body;

    const json = JSON.stringify(data, null, 2);

    try {
      const filePath = await save({
        defaultPath: generateFilename("json"),
        filters: [{
          name: "JSON",
          extensions: ["json"]
        }]
      });

      if (filePath) {
        await writeTextFile(filePath, json);
      }
    } catch (error) {
      console.error("Failed to save file:", error);
      setError("Failed to save file: " + error);
    }

    setShowDownloadMenu(false);
  };

  // Download response as text
  const downloadAsText = async (includeHeaders: boolean = false) => {
    if (!response) return;

    let content = "";

    if (includeHeaders) {
      content += `Status: ${response.status_code}\n`;
      content += `Duration: ${response.duration_ms}ms\n\n`;
      content += "Headers:\n";
      Object.entries(response.headers).forEach(([key, value]) => {
        content += `${key}: ${value}\n`;
      });
      content += "\nBody:\n";
    }

    content += JSON.stringify(response.body, null, 2);

    try {
      const filePath = await save({
        defaultPath: generateFilename("txt"),
        filters: [{
          name: "Text",
          extensions: ["txt"]
        }]
      });

      if (filePath) {
        await writeTextFile(filePath, content);
      }
    } catch (error) {
      console.error("Failed to save file:", error);
      setError("Failed to save file: " + error);
    }

    setShowDownloadMenu(false);
  };

  // Load history entry into request builder
  const loadHistoryEntry = (entry: HistoryEntry) => {
    // Restore all request state
    setMethod(entry.request.method);
    setApiUrl(entry.request.url);
    setQueryParams(entry.request.queryParams.length > 0
      ? entry.request.queryParams
      : [{ key: "", value: "" }]);
    setHeaders(entry.request.headers.length > 0
      ? entry.request.headers
      : [{ key: "", value: "" }]);
    setBodyMode(entry.request.bodyMode);
    setBodyParams(entry.request.bodyParams.length > 0
      ? entry.request.bodyParams
      : [{ key: "", value: "" }]);
    setRawJsonBody(entry.request.rawJsonBody);

    // Clear response state
    setResponse(null);
    setRequestDetails(null);
    setError(null);

    // Close sidebar (especially important on mobile)
    setIsHistorySidebarOpen(false);
  };

  // Clear all history
  const clearHistory = () => {
    if (window.confirm("Clear all request history?")) {
      setHistory([]);
      localStorage.removeItem('zephyr_request_history');
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // History Sidebar Component
  const HistorySidebar = ({
    history,
    isOpen,
    onClose,
    onSelectEntry,
    onClearHistory
  }: {
    history: HistoryEntry[];
    isOpen: boolean;
    onClose: () => void;
    onSelectEntry: (entry: HistoryEntry) => void;
    onClearHistory: () => void;
  }) => {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredHistory = history.filter(entry =>
      entry.request.baseUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.request.method.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getMethodColor = (method: string): string => {
      const colors: Record<string, string> = {
        GET: "#3b82f6",
        POST: "#22c55e",
        PUT: "#f59e0b",
        DELETE: "#ef4444",
        PATCH: "#8b5cf6",
        HEAD: "#6366f1",
        OPTIONS: "#64748b",
      };
      return colors[method] || "#64748b";
    };

    return (
      <div className={`history-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="history-header">
          <h2>Request History</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="history-search">
          <input
            type="text"
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="history-actions">
          <button
            className="clear-history-btn"
            onClick={onClearHistory}
            disabled={history.length === 0}
          >
            Clear All ({history.length})
          </button>
        </div>

        <div className="history-list">
          {filteredHistory.length === 0 ? (
            <div className="empty-history">
              {searchQuery ? "No matching requests" : "No request history yet"}
            </div>
          ) : (
            filteredHistory.map((entry) => (
              <div
                key={entry.id}
                className="history-entry"
                onClick={() => onSelectEntry(entry)}
              >
                <div className="history-entry-header">
                  <span
                    className="method-badge"
                    style={{ backgroundColor: getMethodColor(entry.request.method) }}
                  >
                    {entry.request.method}
                  </span>
                  <span className={`status-indicator ${entry.response.success ? 'success' : 'error'}`}>
                    {entry.response.success ? '✓' : '✗'}
                  </span>
                </div>
                <div className="history-entry-url">{entry.request.baseUrl}</div>
                <div className="history-entry-meta">
                  <span className="timestamp">{formatTimestamp(entry.timestamp)}</span>
                  <span className="duration">{entry.response.duration}ms</span>
                  <span className="status-code">{entry.response.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  async function fetchJson() {
    if (!apiUrl.trim()) {
      setError("Please enter a URL");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);
    setRequestDetails(null);

    try {
      // Filter out empty query params and convert to tuple array
      const validQueryParams = queryParams
        .filter((p) => p.key.trim() !== "")
        .map((p) => [p.key, p.value] as [string, string]);

      // Filter out empty headers and convert to object
      const validHeaders = headers
        .filter((h) => h.key.trim() !== "")
        .reduce((acc, h) => {
          acc[h.key] = h.value;
          return acc;
        }, {} as Record<string, string>);

      // Convert body params to JSON object (only for POST/PUT/PATCH)
      let body = null;
      if (method === "POST" || method === "PUT" || method === "PATCH") {
        if (bodyMode === "raw") {
          // Use raw JSON mode
          if (rawJsonBody.trim()) {
            try {
              body = JSON.parse(rawJsonBody);
              setJsonError(null);
            } catch (e) {
              setJsonError("Invalid JSON: " + (e as Error).message);
              setError("Invalid JSON in request body");
              setLoading(false);
              return;
            }
          }
        } else {
          // Use form mode
          const validBodyParams = bodyParams.filter((p) => p.key.trim() !== "");
          if (validBodyParams.length > 0) {
            body = validBodyParams.reduce((acc, p) => {
              // Try to parse value as JSON, otherwise use as string
              try {
                acc[p.key] = JSON.parse(p.value);
              } catch {
                acc[p.key] = p.value;
              }
              return acc;
            }, {} as Record<string, any>);
          }
        }
      }

      // Save request details for display
      setRequestDetails({
        method,
        url: apiUrl,
        headers: validHeaders,
        queryParams: validQueryParams,
        body,
      });

      const data = await invoke<ApiResponse>("fetch_json", {
        url: apiUrl,
        method: method,
        headers: Object.keys(validHeaders).length > 0 ? validHeaders : null,
        queryParams: validQueryParams.length > 0 ? validQueryParams : null,
        body: body,
      });
      setResponse(data);

      // Capture history
      const historyEntry: HistoryEntry = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        request: {
          method,
          url: apiUrl,
          baseUrl: apiUrl.split('?')[0],
          headers: headers.filter(h => h.key.trim() !== ''),
          queryParams: queryParams.filter(p => p.key.trim() !== ''),
          bodyMode,
          bodyParams: bodyParams.filter(p => p.key.trim() !== ''),
          rawJsonBody,
        },
        response: {
          status: data.status_code,
          duration: data.duration_ms,
          success: data.status_code < 400,
        },
      };

      // Add to history (prepend + trim to 100 entries)
      const updatedHistory = [historyEntry, ...history].slice(0, 100);
      setHistory(updatedHistory);
      saveHistory(updatedHistory);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      {isHistorySidebarOpen && (
        <div className="history-overlay" onClick={() => setIsHistorySidebarOpen(false)} />
      )}
      <HistorySidebar
        history={history}
        isOpen={isHistorySidebarOpen}
        onClose={() => setIsHistorySidebarOpen(false)}
        onSelectEntry={loadHistoryEntry}
        onClearHistory={clearHistory}
      />

      <div className="header">
        <button
          className="history-toggle"
          onClick={() => setIsHistorySidebarOpen(!isHistorySidebarOpen)}
          title="Toggle request history"
          aria-label="Toggle request history"
        >
          <span className="history-icon">🕐</span>
          <span className="history-count">{history.length}</span>
        </button>
        <div className="header-content">
          <h1>Zephyr API</h1>
          <p className="subtitle">A breath of fresh air for API testing</p>
        </div>
        <button
          className="theme-toggle"
          onClick={cycleTheme}
          title={`Theme: ${themeMode} (click to cycle)`}
          aria-label="Toggle theme"
        >
          {themeMode === "auto" ? "🌓" : themeMode === "dark" ? "🌙" : "☀️"}
          <span className="theme-label">{themeMode}</span>
        </button>
      </div>

      <div className="request-builder">
        <div className="method-url-row">
          <select
            className="method-select"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            disabled={loading}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
            <option value="HEAD">HEAD</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>
          <input
            type="text"
            className="url-input"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.currentTarget.value)}
            placeholder="Enter API URL (e.g., https://api.github.com/users/github)"
            disabled={loading}
          />
          <button onClick={fetchJson} disabled={loading}>
            {loading ? "Fetching..." : "Send"}
          </button>
        </div>

        <div className="section-container params-section">
          <div className="tab-container">
            <div className="tab-bar" role="tablist" aria-label="Request options" onKeyDown={handleRequestTabKeyDown}>
              <button
                role="tab"
                aria-selected={requestActiveTab === "query"}
                aria-controls="request-query-panel"
                id="request-query-tab"
                tabIndex={requestActiveTab === "query" ? 0 : -1}
                className={`tab-button ${requestActiveTab === "query" ? "active" : ""}`}
                onClick={() => setRequestActiveTab("query")}
                disabled={loading}
              >
                Query Parameters
              </button>

              <button
                role="tab"
                aria-selected={requestActiveTab === "headers"}
                aria-controls="request-headers-panel"
                id="request-headers-tab"
                tabIndex={requestActiveTab === "headers" ? 0 : -1}
                className={`tab-button ${requestActiveTab === "headers" ? "active" : ""}`}
                onClick={() => setRequestActiveTab("headers")}
                disabled={loading}
              >
                Headers
              </button>

              {(method === "POST" || method === "PUT" || method === "PATCH") && (
                <button
                  role="tab"
                  aria-selected={requestActiveTab === "body"}
                  aria-controls="request-body-panel"
                  id="request-body-tab"
                  tabIndex={requestActiveTab === "body" ? 0 : -1}
                  className={`tab-button ${requestActiveTab === "body" ? "active" : ""}`}
                  onClick={() => setRequestActiveTab("body")}
                  disabled={loading}
                >
                  Request Body
                </button>
              )}
            </div>

            <div className="tab-content">
              <div
                role="tabpanel"
                id="request-query-panel"
                aria-labelledby="request-query-tab"
                hidden={requestActiveTab !== "query"}
                className="tab-panel"
              >
                <div className="key-value-list">
                  {queryParams.map((param, index) => (
                    <div key={index} className="key-value-row">
                      <input
                        type="text"
                        placeholder="Key"
                        value={param.key}
                        onChange={(e) => updateQueryParam(index, "key", e.target.value)}
                        disabled={loading}
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={param.value}
                        onChange={(e) => updateQueryParam(index, "value", e.target.value)}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => removeQueryParam(index)}
                        disabled={loading}
                        className="remove-btn"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addQueryParam}
                    disabled={loading}
                    className="add-btn"
                  >
                    + Add Parameter
                  </button>
                </div>
              </div>

              <div
                role="tabpanel"
                id="request-headers-panel"
                aria-labelledby="request-headers-tab"
                hidden={requestActiveTab !== "headers"}
                className="tab-panel"
              >
                <div className="key-value-list">
                  {headers.map((header, index) => (
                    <div key={index} className="key-value-row">
                      <input
                        type="text"
                        placeholder="Key (e.g., Authorization)"
                        value={header.key}
                        onChange={(e) => updateHeader(index, "key", e.target.value)}
                        disabled={loading}
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={header.value}
                        onChange={(e) => updateHeader(index, "value", e.target.value)}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => removeHeader(index)}
                        disabled={loading}
                        className="remove-btn"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addHeader}
                    disabled={loading}
                    className="add-btn"
                  >
                    + Add Header
                  </button>
                </div>
              </div>

              {(method === "POST" || method === "PUT" || method === "PATCH") && (
                <div
                  role="tabpanel"
                  id="request-body-panel"
                  aria-labelledby="request-body-tab"
                  hidden={requestActiveTab !== "body"}
                  className="tab-panel"
                >
                  <div className="body-mode-toggle">
                    <button
                      type="button"
                      className={bodyMode === "form" ? "active" : ""}
                      onClick={() => setBodyMode("form")}
                      disabled={loading}
                    >
                      Form
                    </button>
                    <button
                      type="button"
                      className={bodyMode === "raw" ? "active" : ""}
                      onClick={() => setBodyMode("raw")}
                      disabled={loading}
                    >
                      Raw JSON
                    </button>
                  </div>

                  {bodyMode === "form" ? (
                    <div className="key-value-list">
                      {bodyParams.map((param, index) => (
                        <div key={index} className="key-value-row">
                          <input
                            type="text"
                            placeholder="Key"
                            value={param.key}
                            onChange={(e) => updateBodyParam(index, "key", e.target.value)}
                            disabled={loading}
                          />
                          <input
                            type="text"
                            placeholder="Value (can be JSON)"
                            value={param.value}
                            onChange={(e) => updateBodyParam(index, "value", e.target.value)}
                            disabled={loading}
                          />
                          <button
                            type="button"
                            onClick={() => removeBodyParam(index)}
                            disabled={loading}
                            className="remove-btn"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addBodyParam}
                        disabled={loading}
                        className="add-btn"
                      >
                        + Add Field
                      </button>
                    </div>
                  ) : (
                    <div className="raw-json-editor">
                      <textarea
                        className="json-textarea"
                        value={rawJsonBody}
                        onChange={(e) => {
                          setRawJsonBody(e.target.value);
                          // Clear error when user starts typing
                          if (jsonError) setJsonError(null);
                        }}
                        placeholder='{\n  "key": "value",\n  "nested": {\n    "example": true\n  }\n}'
                        disabled={loading}
                        spellCheck={false}
                      />
                      {jsonError && <div className="json-error">{jsonError}</div>}
                      <button
                        type="button"
                        className="format-btn"
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(rawJsonBody);
                            setRawJsonBody(JSON.stringify(parsed, null, 2));
                            setJsonError(null);
                          } catch (e) {
                            setJsonError("Invalid JSON: " + (e as Error).message);
                          }
                        }}
                        disabled={loading || !rawJsonBody.trim()}
                      >
                        Format JSON
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-box">
          <strong>Error:</strong> {error}
        </div>
      )}

      {response && requestDetails && (
        <div className="section-container response-section">
          <div className="response-summary">
            <span className={`status-badge status-${Math.floor(response.status_code / 100)}xx`}>
              {response.status_code}
            </span>
            <span className="timing">{response.duration_ms} ms</span>
          </div>

          <div className="tab-container">
            <div className="tab-bar" role="tablist" aria-label="Response information" onKeyDown={handleResponseTabKeyDown}>
              <button
                role="tab"
                aria-selected={responseActiveTab === "body"}
                aria-controls="response-body-panel"
                id="response-body-tab"
                tabIndex={responseActiveTab === "body" ? 0 : -1}
                className={`tab-button ${responseActiveTab === "body" ? "active" : ""}`}
                onClick={() => setResponseActiveTab("body")}
              >
                Response Body
              </button>

              <button
                role="tab"
                aria-selected={responseActiveTab === "headers"}
                aria-controls="response-headers-panel"
                id="response-headers-tab"
                tabIndex={responseActiveTab === "headers" ? 0 : -1}
                className={`tab-button ${responseActiveTab === "headers" ? "active" : ""}`}
                onClick={() => setResponseActiveTab("headers")}
              >
                Response Headers
                <span className="tab-badge">{Object.keys(response.headers).length}</span>
              </button>

              <button
                role="tab"
                aria-selected={responseActiveTab === "details"}
                aria-controls="request-details-panel"
                id="request-details-tab"
                tabIndex={responseActiveTab === "details" ? 0 : -1}
                className={`tab-button ${responseActiveTab === "details" ? "active" : ""}`}
                onClick={() => setResponseActiveTab("details")}
              >
                Request Details
              </button>
            </div>

            <div className="tab-content">
              <div
                role="tabpanel"
                id="response-body-panel"
                aria-labelledby="response-body-tab"
                hidden={responseActiveTab !== "body"}
                className="tab-panel"
              >
                <div className="response-actions">
                  <div className="download-container" ref={downloadMenuRef}>
                    <button
                      className="download-btn"
                      onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      title="Download response"
                    >
                      ⬇ Download
                    </button>
                    {showDownloadMenu && (
                      <div className="download-menu">
                        <button onClick={() => downloadAsJson(false)}>
                          JSON (body only)
                        </button>
                        <button onClick={() => downloadAsJson(true)}>
                          JSON (with headers)
                        </button>
                        <button onClick={() => downloadAsText(false)}>
                          Text (body only)
                        </button>
                        <button onClick={() => downloadAsText(true)}>
                          Text (with headers)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="json-viewer-container">
                  <JsonView
                    value={response.body}
                    collapsed={2}
                    displayDataTypes={false}
                    style={isDarkMode ? darkTheme : undefined}
                  />
                </div>
              </div>

              <div
                role="tabpanel"
                id="response-headers-panel"
                aria-labelledby="response-headers-tab"
                hidden={responseActiveTab !== "headers"}
                className="tab-panel"
              >
                <div className="headers-display">
                  <table>
                    <thead>
                      <tr>
                        <th>Header</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(response.headers).map(([key, value]) => (
                        <tr key={key}>
                          <td className="header-key">{key}</td>
                          <td className="header-value">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                role="tabpanel"
                id="request-details-panel"
                aria-labelledby="request-details-tab"
                hidden={responseActiveTab !== "details"}
                className="tab-panel"
              >
                <div className="request-display">
                  <div className="request-line">
                    <strong>{requestDetails.method}</strong> {requestDetails.url}
                    {requestDetails.queryParams.length > 0 && (
                      <>
                        ?
                        {requestDetails.queryParams
                          .map(([k, v]) => `${k}=${v}`)
                          .join("&")}
                      </>
                    )}
                  </div>

                  {Object.keys(requestDetails.headers).length > 0 && (
                    <>
                      <h4>Request Headers</h4>
                      <table>
                        <tbody>
                          {Object.entries(requestDetails.headers).map(([key, value]) => (
                            <tr key={key}>
                              <td className="header-key">{key}</td>
                              <td className="header-value">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {requestDetails.body && (
                    <>
                      <h4>Request Body</h4>
                      <pre className="body-preview">
                        {JSON.stringify(requestDetails.body, null, 2)}
                      </pre>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
