import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';

interface NotFoundPageProps {
  isDarkMode?: boolean;
}

const NotFoundPage: React.FC<NotFoundPageProps> = ({ isDarkMode = false }) => {
  const navigate = useNavigate();

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 ${
        isDarkMode
          ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
          : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'
      }`}
    >
      <div className="text-center max-w-md mx-auto">
        {/* Icon */}
        <div
          className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${
            isDarkMode ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-amber-500'
          }`}
        >
          <AlertTriangle size={40} strokeWidth={1.5} />
        </div>

        {/* Heading */}
        <h1
          className={`text-2xl md:text-3xl font-bold mb-3 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          This Page Isn't Available
        </h1>

        {/* Description */}
        <p
          className={`text-base md:text-lg mb-8 leading-relaxed ${
            isDarkMode ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          The link may be broken, or the page may have been removed. Check to see if the link you're
          trying to open is correct.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              isDarkMode
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm'
            }`}
          >
            <ArrowLeft size={18} />
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
          >
            <Home size={18} />
            Go to Home
          </button>
        </div>

        {/* Error Code */}
        <p className={`mt-8 text-sm ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
          Error 404 • Page Not Found
        </p>
      </div>
    </div>
  );
};

export default NotFoundPage;
