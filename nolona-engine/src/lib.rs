mod configuration;

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use configuration::network::NetworkManager;
use configuration::storage::StorageManager;
use configuration::config::ConfigManager;


#[derive(Serialize, Deserialize, Debug, Clone)]
struct Instance {
    name: String,
    status: String,
}

#[wasm_bindgen]
pub struct NolonaEngine {
    instances: HashMap<String, Instance>,
}

#[wasm_bindgen]
impl NolonaEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> NolonaEngine {
        NolonaEngine {
            instances: HashMap::new(),
        }
    }

    pub fn execute_command(&mut self, command_str: &str) -> String {
        let parts: Vec<&str> = command_str.split_whitespace().collect();
        if parts.is_empty() { return "Error: No command provided".to_string(); }

        match parts[0] {
            "launch" => self.cmd_launch(parts.get(1)),
            "list" => self.cmd_list(),
            "stop" => self.cmd_stop(parts.get(1)),
            "delete" => self.cmd_delete(parts.get(1)),
            _ => format!("Unknown command: {}", parts[0]),
        }
    }

    fn cmd_launch(&mut self, name: Option<&&str>) -> String {
        match name {
            Some(n) => {
                let n_str = n.to_string();
                self.instances.insert(n_str.clone(), Instance { 
                    name: n_str.clone(), 
                    status: "Running".to_string() 
                });
                format!("Instance '{}' launched.", n_str)
            },
            None => "Usage: nolona launch <name>".to_string(),
        }
    }

    fn cmd_list(&self) -> String {
        if self.instances.is_empty() { return "No instances.".to_string(); }
        serde_json::to_string(&self.instances).unwrap_or("Error serializing".to_string())
    }

    fn cmd_stop(&mut self, name: Option<&&str>) -> String {
        match name {
            Some(n) => {
                if let Some(inst) = self.instances.get_mut(*n) {
                    inst.status = "Stopped".to_string();
                    format!("Instance '{}' stopped.", *n)
                } else {
                    "Instance not found.".to_string()
                }
            },
            None => "Usage: nolona stop <name>".to_string(),
        }
    }

    fn cmd_delete(&mut self, name: Option<&&str>) -> String {
        match name {
            Some(n) => {
                if self.instances.remove(*n).is_some() {
                    format!("Instance '{}' deleted.", *n)
                } else {
                    "Instance not found.".to_string()
                }
            },
            None => "Usage: nolona delete <name>".to_string(),
        }
    }
}
