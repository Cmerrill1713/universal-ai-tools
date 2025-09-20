/**
 * Chat Action Detector Service (Rust)
 * Intelligently detects when chat messages should trigger file system operations
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use warp::Filter;

#[derive(Debug, Serialize, Deserialize)]
pub struct ActionIntent {
    pub action: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub confidence: f64,
    pub reasoning: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileSystemAction {
    #[serde(rename = "type")]
    pub action_type: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub message: String,
    pub user_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActionResponse {
    pub success: bool,
    pub action_intent: Option<ActionIntent>,
    pub file_system_action: Option<FileSystemAction>,
    pub response: String,
}

#[derive(Clone)]
pub struct ChatActionDetector {
    file_system_keywords: HashMap<String, Vec<String>>,
}

impl ChatActionDetector {
    pub fn new() -> Self {
        let mut file_system_keywords = HashMap::new();
        file_system_keywords.insert("create".to_string(), vec![
            "create".to_string(), "make".to_string(), "new".to_string(), "add".to_string(), "generate".to_string()
        ]);
        file_system_keywords.insert("organize".to_string(), vec![
            "organize".to_string(), "sort".to_string(), "arrange".to_string(), "categorize".to_string(), "group".to_string(), "structure".to_string()
        ]);
        file_system_keywords.insert("move".to_string(), vec![
            "move".to_string(), "relocate".to_string(), "transfer".to_string(), "put".to_string(), "place".to_string()
        ]);
        file_system_keywords.insert("folder".to_string(), vec![
            "folder".to_string(), "directory".to_string(), "category".to_string(), "group".to_string()
        ]);
        file_system_keywords.insert("file".to_string(), vec![
            "file".to_string(), "document".to_string(), "text".to_string(), "note".to_string(), "txt".to_string(), "pdf".to_string(), "doc".to_string()
        ]);
        file_system_keywords.insert("desktop".to_string(), vec![
            "desktop".to_string(), "home".to_string(), "documents".to_string(), "downloads".to_string()
        ]);
        file_system_keywords.insert("calendar".to_string(), vec![
            "calendar".to_string(), "cal".to_string(), "schedule".to_string(), "events".to_string(), "appointments".to_string()
        ]);
        file_system_keywords.insert("open".to_string(), vec![
            "open".to_string(), "launch".to_string(), "start".to_string(), "run".to_string(), "execute".to_string()
        ]);
        file_system_keywords.insert("application".to_string(), vec![
            "app".to_string(), "application".to_string(), "program".to_string(), "software".to_string(), "tool".to_string()
        ]);

        Self {
            file_system_keywords,
        }
    }

    pub fn detect_action_intent(&self, message: &str) -> Option<ActionIntent> {
        log::info!("🔍 Analyzing message for action intent: {}", &message[..message.len().min(100)]);

        // Check for file system related keywords
        if !self.has_file_system_keywords(message) {
            return None;
        }

        let lower_message = message.to_lowercase();

        // Simple pattern matching
        if lower_message.contains("create") && (lower_message.contains("folder") || lower_message.contains("directory")) {
            let name = self.extract_name_from_message(message);
            let mut parameters = HashMap::new();
            parameters.insert("name".to_string(), serde_json::Value::String(name));
            
            return Some(ActionIntent {
                action: "create_directory".to_string(),
                parameters,
                confidence: 0.9,
                reasoning: "Detected create directory intent".to_string(),
            });
        }

        if lower_message.contains("organize") && lower_message.contains("desktop") {
            let mut parameters = HashMap::new();
            parameters.insert("operation".to_string(), serde_json::Value::String("organize_all".to_string()));
            
            return Some(ActionIntent {
                action: "organize_desktop".to_string(),
                parameters,
                confidence: 0.9,
                reasoning: "Detected organize desktop intent".to_string(),
            });
        }

        if lower_message.contains("move") && lower_message.contains("to") {
            let mut parameters = HashMap::new();
            parameters.insert("file_pattern".to_string(), serde_json::Value::String("*".to_string()));
            parameters.insert("destination".to_string(), serde_json::Value::String("Organized".to_string()));
            
            return Some(ActionIntent {
                action: "move_files".to_string(),
                parameters,
                confidence: 0.8,
                reasoning: "Detected move files intent".to_string(),
            });
        }

        if lower_message.contains("create") && lower_message.contains("file") {
            let name = self.extract_name_from_message(message);
            let mut parameters = HashMap::new();
            parameters.insert("path".to_string(), serde_json::Value::String(name));
            
            return Some(ActionIntent {
                action: "create_file".to_string(),
                parameters,
                confidence: 0.9,
                reasoning: "Detected create file intent".to_string(),
            });
        }

        if lower_message.contains("open") && lower_message.contains("calendar") {
            let mut parameters = HashMap::new();
            parameters.insert("application".to_string(), serde_json::Value::String("calendar".to_string()));
            
            return Some(ActionIntent {
                action: "open_calendar".to_string(),
                parameters,
                confidence: 0.95,
                reasoning: "Detected open calendar intent".to_string(),
            });
        }

        // General application opening detection
        if lower_message.contains("open") && (lower_message.contains("app") || lower_message.contains("application") || lower_message.contains("program")) {
            let app_name = self.extract_application_name(message);
            let mut parameters = HashMap::new();
            parameters.insert("application".to_string(), serde_json::Value::String(app_name.clone()));
            
            return Some(ActionIntent {
                action: "open_application".to_string(),
                parameters,
                confidence: 0.9,
                reasoning: format!("Detected open application intent for: {}", app_name),
            });
        }

        // Direct application name detection (e.g., "open Safari", "launch Chrome")
        if (lower_message.contains("open") || lower_message.contains("launch") || lower_message.contains("start")) && self.has_application_name(message) {
            let app_name = self.extract_application_name(message);
            let mut parameters = HashMap::new();
            parameters.insert("application".to_string(), serde_json::Value::String(app_name.clone()));
            
            return Some(ActionIntent {
                action: "open_application".to_string(),
                parameters,
                confidence: 0.85,
                reasoning: format!("Detected application launch intent for: {}", app_name),
            });
        }

        // Fallback: general file system intent
        if self.has_file_system_keywords(message) {
            let mut parameters = HashMap::new();
            parameters.insert("operation".to_string(), serde_json::Value::String("analyze".to_string()));
            
            return Some(ActionIntent {
                action: "analyze_desktop".to_string(),
                parameters,
                confidence: 0.6,
                reasoning: "Detected general file system intent".to_string(),
            });
        }

        None
    }

    pub fn convert_to_file_system_action(&self, intent: &ActionIntent) -> Option<FileSystemAction> {
        log::info!("🔧 Converting intent to file system action: {:?}", intent);

        match intent.action.as_str() {
            "create_directory" => {
                let name = intent.parameters.get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("New-Folder");
                
                let mut parameters = HashMap::new();
                parameters.insert("name".to_string(), serde_json::Value::String(name.to_string()));
                parameters.insert("directory".to_string(), serde_json::Value::String("Desktop".to_string()));
                
                Some(FileSystemAction {
                    action_type: "create_directory".to_string(),
                    parameters,
                    description: format!("Create directory: {}", name),
                })
            },
            "organize_desktop" => {
                let mut parameters = HashMap::new();
                parameters.insert("command".to_string(), serde_json::Value::String("ls".to_string()));
                parameters.insert("args".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::String("-la".to_string()),
                    serde_json::Value::String("~/Desktop".to_string()),
                ]));
                
                Some(FileSystemAction {
                    action_type: "run_command".to_string(),
                    parameters,
                    description: "Analyze desktop for organization".to_string(),
                })
            },
            "move_files" => {
                let file_pattern = intent.parameters.get("file_pattern")
                    .and_then(|v| v.as_str())
                    .unwrap_or("*");
                let destination = intent.parameters.get("destination")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Organized");
                
                let mut parameters = HashMap::new();
                parameters.insert("command".to_string(), serde_json::Value::String("mv".to_string()));
                parameters.insert("args".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::String(format!("~/Desktop/{}", file_pattern)),
                    serde_json::Value::String(format!("~/Desktop/{}/", destination)),
                ]));
                
                Some(FileSystemAction {
                    action_type: "run_command".to_string(),
                    parameters,
                    description: format!("Move files matching \"{}\" to \"{}\"", file_pattern, destination),
                })
            },
            "create_file" => {
                let path = intent.parameters.get("path")
                    .and_then(|v| v.as_str())
                    .unwrap_or("new-file.txt");
                
                let mut parameters = HashMap::new();
                parameters.insert("path".to_string(), serde_json::Value::String(path.to_string()));
                parameters.insert("content".to_string(), serde_json::Value::String("Created by Universal AI Tools".to_string()));
                parameters.insert("directory".to_string(), serde_json::Value::String("Desktop".to_string()));
                
                Some(FileSystemAction {
                    action_type: "create_file".to_string(),
                    parameters,
                    description: format!("Create file: {}", path),
                })
            },
            "analyze_desktop" => {
                let mut parameters = HashMap::new();
                parameters.insert("command".to_string(), serde_json::Value::String("ls".to_string()));
                parameters.insert("args".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::String("-la".to_string()),
                    serde_json::Value::String("~/Desktop".to_string()),
                ]));
                
                Some(FileSystemAction {
                    action_type: "run_command".to_string(),
                    parameters,
                    description: "Analyze desktop structure".to_string(),
                })
            },
            "open_calendar" => {
                let mut parameters = HashMap::new();
                parameters.insert("command".to_string(), serde_json::Value::String("open".to_string()));
                parameters.insert("args".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::String("-a".to_string()),
                    serde_json::Value::String("Calendar".to_string()),
                ]));
                
                Some(FileSystemAction {
                    action_type: "run_command".to_string(),
                    parameters,
                    description: "Open Calendar application".to_string(),
                })
            },
            "open_application" => {
                let app_name = intent.parameters.get("application")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Application");
                
                let mut parameters = HashMap::new();
                parameters.insert("command".to_string(), serde_json::Value::String("open".to_string()));
                parameters.insert("args".to_string(), serde_json::Value::Array(vec![
                    serde_json::Value::String("-a".to_string()),
                    serde_json::Value::String(app_name.to_string()),
                ]));
                
                Some(FileSystemAction {
                    action_type: "run_command".to_string(),
                    parameters,
                    description: format!("Open {} application", app_name),
                })
            },
            _ => None,
        }
    }

    pub fn generate_action_response(&self, action: &FileSystemAction, result: &serde_json::Value) -> String {
        match action.action_type.as_str() {
            "create_directory" => {
                let name = action.parameters.get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("folder");
                format!("✅ Created folder \"{}\" on your desktop!", name)
            },
            "create_file" => {
                let path = action.parameters.get("path")
                    .and_then(|v| v.as_str())
                    .unwrap_or("file");
                format!("✅ Created file \"{}\" on your desktop!", path)
            },
            "run_command" => {
                if let Some(command) = action.parameters.get("command").and_then(|v| v.as_str()) {
                    if command == "ls" {
                        format!("📁 Analyzed your desktop structure. Found {} items.", 
                            result.get("output").and_then(|v| v.as_str())
                                .map(|s| s.lines().count())
                                .unwrap_or(0))
                    } else if command == "open" {
                        if let Some(args) = action.parameters.get("args").and_then(|v| v.as_array()) {
                            if args.len() >= 2 {
                                let app_name = args[1].as_str().unwrap_or("Application");
                                format!("🚀 {} opened successfully!", app_name)
                            } else {
                                format!("🚀 Application opened successfully!")
                            }
                        } else {
                            format!("🚀 Application opened successfully!")
                        }
                    } else {
                        format!("✅ Executed: {}", action.description)
                    }
                } else {
                    format!("✅ Action completed: {}", action.description)
                }
            },
            _ => format!("✅ Action completed: {}", action.description),
        }
    }

    fn has_file_system_keywords(&self, message: &str) -> bool {
        let lower_message = message.to_lowercase();
        
        for keywords in self.file_system_keywords.values() {
            if keywords.iter().any(|keyword| lower_message.contains(keyword)) {
                return true;
            }
        }
        
        false
    }

    fn extract_name_from_message(&self, message: &str) -> String {
        // Simple extraction - look for quoted text or words after "called" or "named"
        let lower_message = message.to_lowercase();
        
        if let Some(start) = lower_message.find("called ") {
            let after_called = &message[start + 7..];
            let end = after_called.find(' ').unwrap_or(after_called.len());
            return after_called[..end].trim_matches('"').trim_matches('\'').to_string();
        }
        
        if let Some(start) = lower_message.find("named ") {
            let after_named = &message[start + 6..];
            let end = after_named.find(' ').unwrap_or(after_named.len());
            return after_named[..end].trim_matches('"').trim_matches('\'').to_string();
        }
        
        // Look for quoted text
        if let Some(start) = message.find('"') {
            if let Some(end) = message[start + 1..].find('"') {
                return message[start + 1..start + 1 + end].to_string();
            }
        }
        
        "New-Item".to_string()
    }

    fn extract_application_name(&self, message: &str) -> String {
        let lower_message = message.to_lowercase();
        
        // Common application names and their variations
        let app_mappings = [
            ("safari", "Safari"),
            ("chrome", "Google Chrome"),
            ("firefox", "Firefox"),
            ("edge", "Microsoft Edge"),
            ("calendar", "Calendar"),
            ("mail", "Mail"),
            ("messages", "Messages"),
            ("facetime", "FaceTime"),
            ("photos", "Photos"),
            ("music", "Music"),
            ("spotify", "Spotify"),
            ("vscode", "Visual Studio Code"),
            ("code", "Visual Studio Code"),
            ("xcode", "Xcode"),
            ("finder", "Finder"),
            ("terminal", "Terminal"),
            ("notes", "Notes"),
            ("reminders", "Reminders"),
            ("maps", "Maps"),
            ("weather", "Weather"),
            ("calculator", "Calculator"),
            ("textedit", "TextEdit"),
            ("preview", "Preview"),
            ("system preferences", "System Preferences"),
            ("activity monitor", "Activity Monitor"),
            ("disk utility", "Disk Utility"),
            ("keychain access", "Keychain Access"),
            ("console", "Console"),
            ("font book", "Font Book"),
            ("color sync utility", "ColorSync Utility"),
        ];
        
        // Check for exact matches first
        for (keyword, app_name) in &app_mappings {
            if lower_message.contains(keyword) {
                return app_name.to_string();
            }
        }
        
        // Look for quoted application names
        if let Some(start) = message.find('"') {
            if let Some(end) = message[start + 1..].find('"') {
                let quoted_name = message[start + 1..start + 1 + end].to_string();
                return quoted_name;
            }
        }
        
        // Look for application names after "open", "launch", "start"
        let open_words = ["open", "launch", "start", "run", "execute"];
        for word in &open_words {
            if let Some(start) = lower_message.find(word) {
                let after_word = &message[start + word.len()..].trim();
                if !after_word.is_empty() {
                    // Take all words after the command, not just the first one
                    let app_name = after_word.trim_matches('"').trim_matches('\'');
                    if !app_name.is_empty() {
                        // Capitalize first letter of each word
                        let words: Vec<&str> = app_name.split_whitespace().collect();
                        let capitalized_words: Vec<String> = words.iter().map(|word| {
                            let mut chars = word.chars();
                            if let Some(first) = chars.next() {
                                format!("{}{}", first.to_uppercase(), chars.as_str())
                            } else {
                                word.to_string()
                            }
                        }).collect();
                        return capitalized_words.join(" ");
                    }
                }
            }
        }
        
        "Application".to_string()
    }

    fn has_application_name(&self, message: &str) -> bool {
        let lower_message = message.to_lowercase();
        
        // Check for common application names
        let app_names = [
            "safari", "chrome", "firefox", "edge", "calendar", "mail", "messages",
            "facetime", "photos", "music", "spotify", "vscode", "code", "xcode",
            "finder", "terminal", "notes", "reminders", "maps", "weather",
            "calculator", "textedit", "preview", "system preferences",
            "activity monitor", "disk utility", "keychain access", "console",
            "font book", "color sync utility"
        ];
        
        for app_name in &app_names {
            if lower_message.contains(app_name) {
                return true;
            }
        }
        
        // Check for quoted text (likely application names)
        if message.contains('"') {
            return true;
        }
        
        false
    }
}

#[tokio::main]
async fn main() {
    env_logger::init();
    
    let detector = ChatActionDetector::new();
    
    // Create routes
    let detect_action = warp::path("detect")
        .and(warp::post())
        .and(warp::body::json())
        .map(move |message: ChatMessage| {
            let action_intent = detector.detect_action_intent(&message.message);
            
            let response = if let Some(intent) = action_intent {
                if intent.confidence > 0.7 {
                    if let Some(file_system_action) = detector.convert_to_file_system_action(&intent) {
                        ActionResponse {
                            success: true,
                            action_intent: Some(intent),
                            file_system_action: Some(file_system_action),
                            response: "Action detected and ready for execution".to_string(),
                        }
                    } else {
                        ActionResponse {
                            success: false,
                            action_intent: Some(intent),
                            file_system_action: None,
                            response: "Action detected but could not be converted to file system operation".to_string(),
                        }
                    }
                } else {
                    ActionResponse {
                        success: false,
                        action_intent: Some(intent),
                        file_system_action: None,
                        response: "Action detected but confidence too low".to_string(),
                    }
                }
            } else {
                ActionResponse {
                    success: false,
                    action_intent: None,
                    file_system_action: None,
                    response: "No file system action detected".to_string(),
                }
            };
            
            warp::reply::json(&response)
        });

    let health = warp::path("health")
        .and(warp::get())
        .map(|| warp::reply::json(&serde_json::json!({
            "status": "healthy",
            "service": "chat-action-detector",
            "version": "1.0.0"
        })));

    let routes = detect_action.or(health);

    log::info!("🚀 Starting Chat Action Detector service on port 3034");
    warp::serve(routes)
        .run(([0, 0, 0, 0], 3034))
        .await;
}