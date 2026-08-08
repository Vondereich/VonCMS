import React from 'react';
import { ArrowLeft, LayoutDashboard, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router';

const AdminNotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section
      aria-labelledby="admin-not-found-title"
      className="mx-auto flex min-h-full w-full max-w-2xl items-center justify-center py-12"
    >
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs dark:border-white/10 dark:bg-[#1a1b26] sm:p-10">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
          <TriangleAlert size={30} strokeWidth={1.75} aria-hidden="true" />
        </div>

        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Error 404
        </p>
        <h1
          id="admin-not-found-title"
          className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl"
        >
          Admin page not found
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-400 sm:text-base">
          The address may be incorrect, or this admin page may no longer be available.
        </p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Go Back
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <LayoutDashboard size={18} aria-hidden="true" />
            Go to Dashboard
          </button>
        </div>
      </div>
    </section>
  );
};

export default AdminNotFoundPage;
