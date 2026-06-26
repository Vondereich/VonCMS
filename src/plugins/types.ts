export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  init: (context: PluginContext) => void;
}

export interface PluginContext {
  registerHook: (hookName: string, callback: Function) => void;
  registerComponent: (slotName: string, component: React.ComponentType<any>) => void;
  // Add more capabilities as needed
}

export interface PluginRegistry {
  [pluginId: string]: Plugin;
}
