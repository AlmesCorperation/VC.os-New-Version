use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StoragePool {
    pub name: String,
    pub capacity: u64,
}

#[wasm_bindgen]
pub struct StorageManager {
    pub pools: Vec<StoragePool>,
}

#[wasm_bindgen]
impl StorageManager {
    #[wasm_bindgen(constructor)]
    pub fn new() -> StorageManager {
        StorageManager { pools: Vec::new() }
    }

    pub fn create_pool(&mut self, name: &str, capacity: u64) -> String {
        self.pools.push(StoragePool {
            name: name.to_string(),
            capacity,
        });
        format!("Storage pool '{}' created with {}GB.", name, capacity)
    }
}
