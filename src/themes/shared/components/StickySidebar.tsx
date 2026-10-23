import React, { useEffect, useRef } from 'react';

type StickySidebarProps = React.PropsWithChildren<{ className?: string }>;

export default function StickySidebar({ children, className = '' }: StickySidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    // Keep normal document flow if size observation is unavailable.
    if (!sidebar || typeof ResizeObserver === 'undefined') return;

    const updateHeight = () => {
      sidebar.style.setProperty(
        '--voncms-sidebar-height',
        `${Math.ceil(sidebar.getBoundingClientRect().height)}px`
      );
    };
    const observer = new ResizeObserver(updateHeight);
    observer.observe(sidebar);
    updateHeight();
    sidebar.setAttribute('data-sticky-ready', 'true');

    return () => observer.disconnect();
  }, []);

  return (
    <aside
      ref={sidebarRef}
      aria-label="Sidebar widgets"
      data-voncms-sidebar="sticky"
      className={`w-full lg:self-start lg:data-[sticky-ready=true]:sticky lg:top-[min(6rem,calc(100dvh-var(--voncms-sidebar-height,0px)-1.5rem))] ${className}`}
    >
      {children}
    </aside>
  );
}
