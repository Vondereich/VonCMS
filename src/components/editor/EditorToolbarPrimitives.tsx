import type { ReactNode } from 'react';

interface ToolButtonProps {
  icon: ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}

export const ToolButton = ({ icon, onClick, title, active = false }: ToolButtonProps) => (
  <button
    type="button"
    aria-label={title}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border shadow-xs transition-colors duration-150 hover:shadow-sm xl:h-8 xl:w-8 ${
      active
        ? 'border-blue-500 bg-blue-600 text-white shadow-blue-500/20 dark:border-blue-400 dark:bg-blue-500 dark:text-white'
        : 'border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-[#2a2b36] dark:bg-[#1a1b26]/90 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-[#242633] dark:hover:text-white'
    }`}
    title={title}
  >
    {icon}
  </button>
);

export const Divider = () => (
  <div className="mx-0.5 hidden h-6 w-px rounded-sm bg-slate-200 dark:bg-[#242633] xl:block" />
);
