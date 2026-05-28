use serde::{Deserialize, Serialize};

const GROK_MODEL: &str = "grok-4-1-fast-non-reasoning";
const GROK_BASE_URL: &str = "https://api.x.ai/v1";
const OPENAI_BASE_URL: &str = "https://api.openai.com/v1";
const GEMINI_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEEPSEEK_BASE_URL: &str = "https://api.deepseek.com";
const CUSTOM_BASE_URL: &str = "http://localhost:11434/v1";
const OLLAMA_MODEL: &str = "gemma3:4b";
const OPENAI_MODEL: &str = "gpt-4.1";
const GEMINI_MODEL: &str = "gemini-3-flash-preview";
const DEEPSEEK_MODEL: &str = "deepseek-chat";

#[derive(Serialize)]
struct GrokRequest {
    model: String,
    messages: Vec<GrokMessage>,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Serialize, Deserialize)]
struct GrokMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct GrokResponse {
    choices: Vec<GrokChoice>,
}

#[derive(Deserialize)]
struct GrokChoice {
    message: GrokMessage,
}

#[derive(Deserialize)]
pub struct DirectoryItemContext {
    pub name: String,
    pub path: String,
    pub kind: String,
}

#[derive(Serialize)]
pub struct LocalModelStatus {
    pub base_url: String,
    pub running: bool,
    pub model_available: bool,
    pub models: Vec<String>,
    pub message: String,
}

#[derive(Deserialize)]
struct ModelListResponse {
    data: Option<Vec<ModelEntry>>,
}

#[derive(Deserialize)]
struct ModelEntry {
    id: Option<String>,
    name: Option<String>,
}

fn clean_command(raw: &str) -> String {
    let cleaned = raw.trim()
        .trim_start_matches("```bash")
        .trim_start_matches("```sh")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .trim_start_matches('$')
        .trim()
        .to_string();

    if cleaned.to_lowercase().starts_with("clarify:") {
        cleaned
    } else {
        cleaned
            .lines()
            .next()
            .unwrap_or_default()
            .trim()
            .to_string()
    }
}

fn chat_completions_endpoint(provider: &str, base_url: &str) -> String {
    let normalized_base_url = match provider {
        "grok" => GROK_BASE_URL,
        "openai" => OPENAI_BASE_URL,
        "gemini" => GEMINI_BASE_URL,
        "deepseek" => DEEPSEEK_BASE_URL,
        "ollama" => {
            let trimmed = base_url.trim();
            if trimmed.is_empty() {
                CUSTOM_BASE_URL
            } else {
                trimmed
            }
        }
        _ => {
            let trimmed = base_url.trim();
            if trimmed.is_empty() {
                CUSTOM_BASE_URL
            } else {
                trimmed
            }
        }
    };

    let trimmed = normalized_base_url.trim_end_matches('/');

    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else {
        format!("{trimmed}/chat/completions")
    }
}

fn provider_label(provider: &str) -> &'static str {
    match provider {
        "openai" => "OpenAI",
        "gemini" => "Gemini",
        "deepseek" => "DeepSeek",
        "ollama" => "Local model",
        "custom" => "Custom provider",
        _ => "Grok",
    }
}

fn default_model(provider: &str) -> &'static str {
    match provider {
        "openai" => OPENAI_MODEL,
        "gemini" => GEMINI_MODEL,
        "deepseek" => DEEPSEEK_MODEL,
        "ollama" => OLLAMA_MODEL,
        "custom" => "llama3.2",
        _ => GROK_MODEL,
    }
}

#[tauri::command]
pub async fn ask_grok(
    provider: String,
    api_key: String,
    model: String,
    base_url: String,
    user_prompt: String,
    personalization: String,
    selected_files: Vec<String>,
    current_directory: String,
    directory_items: Vec<DirectoryItemContext>,
) -> Result<String, String> {
    let provider = provider.trim().to_lowercase();
    let provider_name = provider_label(&provider);
    let requires_api_key = provider != "custom" && provider != "ollama";
    let model = if model.trim().is_empty() {
        default_model(&provider).to_string()
    } else {
        model.trim().to_string()
    };

    if requires_api_key && api_key.trim().is_empty() {
        return Err(format!("Missing {provider_name} API key"));
    }

    let file_context = if selected_files.is_empty() {
        "No files selected.".to_string()
    } else {
        format!("Selected files:\n{}", selected_files.join("\n"))
    };
    let folder_context = if directory_items.is_empty() {
        "Current Finder folder visible items: none or unavailable.".to_string()
    } else {
        let items = directory_items
            .iter()
            .take(80)
            .map(|item| format!("- {}: {} ({})", item.kind, item.path, item.name))
            .collect::<Vec<_>>()
            .join("\n");
        format!("Current Finder folder visible items:\n{items}")
    };

    let system_prompt = format!(
        r#"You are a careful macOS file-operation copilot. You receive a natural language request and Finder context.

Before answering, silently reason through:
1. Which exact selected files or current Finder directory the user likely means.
2. Whether the requested source paths are actually present in selected files or visible current-folder items.
3. Whether the action could overwrite, delete, or move the wrong thing.

Output exactly one of these:
- CLARIFY: one short question, if the request is ambiguous or the needed target/source is not clear.
- A single bash command or short piped chain, with no explanation, no markdown, no backticks, no leading dollar sign.

Context:
- Current Finder directory: {}
- {}
- {}
- User personalization:
{}
- macOS version: assume latest macOS on Apple Silicon
- Available tools: standard macOS CLI, sips, qlmanage, afconvert, ditto, zip, tar. Use ffmpeg, ImageMagick, or pandoc only when clearly needed.

Rules:
- Output ONLY the command, nothing else.
- Use full absolute paths when referencing selected files.
- Quote every file path.
- Prefer selected files/folders over guessing names inside the current directory.
- If no file is selected, you may use an exact visible current-folder item by name/path.
- For file conversions, output to the same directory as the source file.
- If multiple files are selected, handle them all in one command using a loop when helpful.
- Do not invent file paths. Never use placeholder paths like "the file", "the files", "the image", or "images".
- If the user refers to a vague target like "the file", "the image", "the files", "these images", or "it" and no exact file is selected, output CLARIFY instead of a command.
- If the user asks to rename multiple files to one name and the final naming pattern is unclear, output CLARIFY.
- If the user says "this folder", "my folder", or "current folder" and no files are selected, operate on the current Finder directory itself.
- For renaming the current folder, rename it to a sibling path in its parent directory. Never move a folder inside itself.
- Avoid destructive commands unless the user's request explicitly asks for deletion or overwriting.
- Prefer commands that create new output files rather than overwriting originals."#,
        current_directory,
        file_context,
        folder_context,
        if personalization.trim().is_empty() {
            "No extra user preferences.".to_string()
        } else {
            personalization.trim().to_string()
        }
    );

    let request = GrokRequest {
        model: model.clone(),
        messages: vec![
            GrokMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            GrokMessage {
                role: "user".to_string(),
                content: user_prompt,
            },
        ],
        temperature: 0.1,
        max_tokens: 500,
    };

    let client = reqwest::Client::new();
    let endpoint = chat_completions_endpoint(&provider, &base_url);
    let mut request_builder = client.post(endpoint).json(&request);

    if !api_key.trim().is_empty() {
        request_builder = request_builder.bearer_auth(api_key.trim());
    }

    let response = request_builder
        .send()
        .await
        .map_err(|error| {
            if provider == "ollama" {
                format!(
                    "Local model request failed: {error}. Start your local model server and make sure `{model}` is installed."
                )
            } else {
                format!("{provider_name} API request failed: {error}")
            }
        })?;

    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|error| format!("Failed to read Grok response: {error}"))?;

    if !status.is_success() {
        return Err(format!("{provider_name} API returned {status}: {response_text}"));
    }

    let grok_response: GrokResponse = serde_json::from_str(&response_text)
        .map_err(|error| format!("Failed to parse {provider_name} response: {error}"))?;

    let raw_command = grok_response
        .choices
        .first()
        .map(|choice| choice.message.content.as_str())
        .ok_or_else(|| format!("No response from {provider_name}"))?;

    let command = clean_command(raw_command);

    if command.is_empty() {
        Err(format!("{provider_name} returned an empty command"))
    } else {
        Ok(command)
    }
}

#[tauri::command]
pub async fn check_local_model_status(
    base_url: String,
    model: String,
) -> Result<LocalModelStatus, String> {
    let endpoint = chat_completions_endpoint("ollama", &base_url)
        .trim_end_matches("/chat/completions")
        .to_string();
    let models_endpoint = format!("{}/models", endpoint.trim_end_matches('/'));
    let client = reqwest::Client::new();

    let response = match client.get(&models_endpoint).send().await {
        Ok(response) => response,
        Err(error) => {
            return Ok(LocalModelStatus {
                base_url: endpoint,
                running: false,
                model_available: false,
                models: vec![],
                message: format!("Local server is not reachable: {error}"),
            });
        }
    };

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read local model status: {error}"))?;

    if !status.is_success() {
        return Ok(LocalModelStatus {
            base_url: endpoint,
            running: false,
            model_available: false,
            models: vec![],
            message: format!("Local server returned {status}: {body}"),
        });
    }

    let parsed: ModelListResponse = serde_json::from_str(&body)
        .map_err(|error| format!("Failed to parse local model list: {error}"))?;

    let mut models: Vec<String> = parsed
        .data
        .unwrap_or_default()
        .into_iter()
        .filter_map(|entry| entry.id.or(entry.name))
        .filter(|name| !name.trim().is_empty())
        .collect();
    models.sort();
    models.dedup();

    let trimmed_model = model.trim();
    let model_available = !trimmed_model.is_empty()
        && models
            .iter()
            .any(|available| available == trimmed_model || available.starts_with(trimmed_model));

    let message = if models.is_empty() {
        "Local server is running, but no models were reported.".to_string()
    } else if model_available {
        format!("Local model `{trimmed_model}` is ready.")
    } else if trimmed_model.is_empty() {
        format!("Local server is running with {} model(s).", models.len())
    } else {
        format!("Local server is running, but `{trimmed_model}` was not found.")
    };

    Ok(LocalModelStatus {
        base_url: endpoint,
        running: true,
        model_available,
        models,
        message,
    })
}
