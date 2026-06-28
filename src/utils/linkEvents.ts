import type React from 'react';

export const handleCrawlableLinkClick = (
  event: React.MouseEvent<HTMLAnchorElement>,
  navigate: () => void
) => {
  if (event.defaultPrevented) {
    return;
  }

  event.stopPropagation();

  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  event.preventDefault();
  navigate();
};
