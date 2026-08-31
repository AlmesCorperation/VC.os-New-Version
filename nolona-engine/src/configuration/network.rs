use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NetworkConfig {
    pub name: String,
    pub subnet: String,
}

#[wasm_bindgen]
pub struct NetworkManager {
    pub networks: Vec<NetworkConfig>,
}

#[wasm_bindgen]
impl NetworkManager {
    #[wasm_bindgen(constructor)]
    pub fn new() -> NetworkManager {
        NetworkManager { networks: Vec::new() }
    }

    pub fn create_network(&mut self, name: &str, subnet: &str) -> String {
        self.networks.push(NetworkConfig {
            name: name.to_string(),
            subnet: subnet.to_string(),
        });
        format!("Network '{}' created with subnet {}.", name, subnet)
    }
}
