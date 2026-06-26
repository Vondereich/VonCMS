import React from 'react';
import { Wrench, Mail, ArrowRight } from 'lucide-react';

interface MaintenancePageProps {
  siteName?: string;
  onAdminLogin?: () => void;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({
  siteName = 'My Website',
  onAdminLogin,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 max-w-lg w-full">
        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-4 animate-bounce">
              <Wrench className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Under Maintenance</h1>
            <p className="text-white/80">We'll be back shortly</p>
          </div>

          {/* Content */}
          <div className="p-8 text-center">
            <div className="mb-8">
              <p className="text-slate-300 text-lg leading-relaxed">
                We're currently performing scheduled maintenance to improve your experience. Please
                check back soon!
              </p>
            </div>

            {/* Progress indicator */}
            <div className="mb-8">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse delay-150"></div>
                <div className="w-3 h-3 bg-pink-500 rounded-full animate-pulse delay-300"></div>
              </div>
              <p className="text-slate-400 text-sm">Work in progress...</p>
            </div>

            {/* Divider */}
            <div className="border-t border-white/10 pt-6">
              <p className="text-slate-400 text-sm mb-4">Need urgent assistance?</p>
              <a
                href="mailto:admin@example.com"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Contact Support
              </a>
            </div>
          </div>

          {/* Admin Login Link */}
          {onAdminLogin && (
            <div className="px-8 pb-8">
              <button
                onClick={onAdminLogin}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-all group"
              >
                Admin Login
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm">
            Powered by <span className="text-slate-400">{siteName}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
