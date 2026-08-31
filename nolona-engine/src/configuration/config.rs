use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstanceConfig {
    pub cpu_limit: u32,
    pub mem_limit: u64,
}

#[wasm_bindgen]
pub struct ConfigManager {
    pub config: InstanceConfig,
}

#[wasm_bindgen]
impl ConfigManager {
    #[wasm_bindgen(constructor)]
    pub fn new() -> ConfigManager {
        ConfigManager {
            config: InstanceConfig { cpu_limit: 1, mem_limit: 512 },
        }
    }

    pub fn set_limits(&mut self, cpu: u32, mem: u64) {
        self.config.cpu_limit = cpu;
        self.config.mem_limit = mem;
    }
}
