import { useState, useEffect } from 'react';

class SettingsStore {
  private listeners: Set<() => void> = new Set();
  public performanceMode: boolean = true;
  public isWifiConnected: boolean = true; // default to true since initially everything works

  constructor() {
    const saved = localStorage.getItem('vcos_performance_mode');
    if (saved) {
      try {
        this.performanceMode = JSON.parse(saved);
      } catch (e) {}
    }
    const wifiSaved = localStorage.getItem('vcos_wifi_connected');
    if (wifiSaved) {
      try {
        this.isWifiConnected = JSON.parse(wifiSaved);
      } catch (e) {}
    }
  }

  setPerformanceMode(value: boolean) {
    this.performanceMode = value;
    localStorage.setItem('vcos_performance_mode', JSON.stringify(value));
    this.notify();
  }

  setWifiConnected(value: boolean) {
    this.isWifiConnected = value;
    localStorage.setItem('vcos_wifi_connected', JSON.stringify(value));
    this.notify();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const settingsStore = new SettingsStore();

export const useSettings = () => {
  const [performanceMode, setPerformanceMode] = useState(settingsStore.performanceMode);
  const [isWifiConnected, setWifiConnected] = useState(settingsStore.isWifiConnected);

  useEffect(() => {
    return settingsStore.subscribe(() => {
      setPerformanceMode(settingsStore.performanceMode);
      setWifiConnected(settingsStore.isWifiConnected);
    });
  }, []);

  return { 
    performanceMode, 
    setPerformanceMode: (val: boolean) => settingsStore.setPerformanceMode(val),
    isWifiConnected,
    setWifiConnected: (val: boolean) => settingsStore.setWifiConnected(val)
  };
};
