import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Plugin, PluginContext } from './types';

interface PluginSystemContextType {
  plugins: Plugin[];
  hooks: Record<string, Function[]>;
  components: Record<string, React.ComponentType<any>[]>;
  registerPlugin: (plugin: Plugin) => void;
  applyFilters: <T>(hookName: string, content: T, ...args: any[]) => T;
  doAction: (hookName: string, ...args: any[]) => void;
  getComponents: (slotName: string) => React.ComponentType<any>[];
}

const PluginSystemContext = createContext<PluginSystemContextType | undefined>(undefined);

export const usePluginSystem = () => {
  const context = useContext(PluginSystemContext);
  if (!context) {
    throw new Error('usePluginSystem must be used within a PluginProvider');
  }
  return context;
};

export const PluginProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [hooks, setHooks] = useState<Record<string, Function[]>>({});
  const [components, setComponents] = useState<Record<string, React.ComponentType<any>[]>>({});

  const pluginContext: PluginContext = {
    registerHook: (hookName, callback) => {
      setHooks((prev) => ({
        ...prev,
        [hookName]: [...(prev[hookName] || []), callback],
      }));
    },
    registerComponent: (slotName, component) => {
      setComponents((prev) => ({
        ...prev,
        [slotName]: [...(prev[slotName] || []), component],
      }));
    },
  };

  const registerPlugin = (plugin: Plugin) => {
    // Avoid duplicates
    if (plugins.find((p) => p.id === plugin.id)) return;

    plugin.init(pluginContext);
    setPlugins((prev) => [...prev, plugin]);
  };

  const applyFilters = <T,>(hookName: string, content: T, ...args: any[]): T => {
    const callbacks = hooks[hookName] || [];
    return callbacks.reduce((acc, callback) => callback(acc, ...args), content);
  };

  const doAction = (hookName: string, ...args: any[]) => {
    const callbacks = hooks[hookName] || [];
    callbacks.forEach((callback) => callback(...args));
  };

  const getComponents = (slotName: string) => {
    return components[slotName] || [];
  };

  return (
    <PluginSystemContext.Provider
      value={{ plugins, hooks, components, registerPlugin, applyFilters, doAction, getComponents }}
    >
      {children}
    </PluginSystemContext.Provider>
  );
};
