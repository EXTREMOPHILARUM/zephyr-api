import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
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
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <div className="header">
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

        <div className="params-section">
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
        <div className="response-section">
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
