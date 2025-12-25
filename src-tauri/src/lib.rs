use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::time::Instant;

#[derive(Serialize, Deserialize)]
struct ApiResponse {
    status_code: u16,
    headers: HashMap<String, String>,
    body: Value,
    duration_ms: u128,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn fetch_json(
    url: String,
    method: String,
    headers: Option<HashMap<String, String>>,
    query_params: Option<Vec<(String, String)>>,
    body: Option<Value>,
) -> Result<ApiResponse, String> {
    // Start timing
    let start_time = Instant::now();

    // Validate URL is not empty
    if url.trim().is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    // Validate method
    let method = method.to_uppercase();
    if !["GET", "POST", "PUT", "DELETE"].contains(&method.as_str()) {
        return Err(format!("Unsupported HTTP method: {}", method));
    }

    // Create HTTP client with timeout
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Build URL with query parameters
    let mut full_url = url.clone();
    if let Some(params) = query_params {
        if !params.is_empty() {
            let query_string: String = params
                .iter()
                .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
                .collect::<Vec<_>>()
                .join("&");

            if full_url.contains('?') {
                full_url.push('&');
            } else {
                full_url.push('?');
            }
            full_url.push_str(&query_string);
        }
    }

    // Build request based on method
    let mut request = match method.as_str() {
        "GET" => client.get(&full_url),
        "POST" => client.post(&full_url),
        "PUT" => client.put(&full_url),
        "DELETE" => client.delete(&full_url),
        _ => return Err(format!("Unsupported method: {}", method)),
    };

    // Add custom headers
    if let Some(headers_map) = headers {
        for (key, value) in headers_map {
            request = request.header(key, value);
        }
    }

    // Add request body for POST/PUT
    if method == "POST" || method == "PUT" {
        if let Some(body_data) = body {
            request = request.json(&body_data);
        }
    }

    // Send request
    let response = request
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    // Extract status code
    let status_code = response.status().as_u16();

    // Extract response headers
    let mut response_headers = HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(value_str) = value.to_str() {
            response_headers.insert(key.to_string(), value_str.to_string());
        }
    }

    // Check HTTP status code
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", status_code));
    }

    // Parse JSON response
    let json_data: Value = response
        .json()
        .await
        .map_err(|e| format!("Invalid JSON response: {}", e))?;

    // Calculate duration
    let duration_ms = start_time.elapsed().as_millis();

    Ok(ApiResponse {
        status_code,
        headers: response_headers,
        body: json_data,
        duration_ms,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, fetch_json])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
