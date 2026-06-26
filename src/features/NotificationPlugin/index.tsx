import React, { useState } from 'react';
import { Plugin, PluginContext } from '../../plugins/types';
import { Bell } from 'lucide-react';

const NotificationComponent: React.FC = () => {
  const [show, setShow] = useState(true);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg flex items-center gap-3 animate-bounce">
      <Bell size={20} />
      <div>
        <h4 className="font-bold text-sm">System Notification</h4>
        <p className="text-xs">Plugin System is Active!</p>
      </div>
      <button onClick={() => setShow(false)} className="ml-2 text-white/70 hover:text-white">
        ×
      </button>
    </div>
  );
};

export const NotificationPlugin: Plugin = {
  id: 'notification-plugin',
  name: 'Notification System',
  version: '1.0.0',
  init: (context: PluginContext) => {
    // Register the component to a slot (e.g., 'app_footer' or 'global_overlay')
    context.registerComponent('global_overlay', NotificationComponent);
  },
};
