import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import JsonView from "@uiw/react-json-view";
import { darkTheme } from "@uiw/react-json-view/dark";
import "./App.css";

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
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

      // Convert body params to JSON object (only for POST/PUT)
      let body = null;
      if (method === "POST" || method === "PUT" || method === "PATCH") {
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

  const isDarkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

  return (
    <main className="container">
      <h1>Zephyr API</h1>
      <p className="subtitle">A breath of fresh air for API testing</p>

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
          <details>
            <summary>Query Parameters</summary>
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
          </details>

          <details>
            <summary>Headers</summary>
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
          </details>

          {(method === "POST" || method === "PUT" || method === "PATCH") && (
            <details>
              <summary>Request Body</summary>
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
            </details>
          )}
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

          <div className="details-tabs">
            <details open>
              <summary>Response Body</summary>
              <div className="json-viewer-container">
                <JsonView
                  value={response.body}
                  collapsed={2}
                  displayDataTypes={false}
                  style={isDarkMode ? darkTheme : undefined}
                />
              </div>
            </details>

            <details>
              <summary>Response Headers ({Object.keys(response.headers).length})</summary>
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
            </details>

            <details>
              <summary>Request Details</summary>
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
            </details>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
