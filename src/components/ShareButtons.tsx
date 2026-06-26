import React from 'react';
import {
  FacebookShareButton,
  TwitterShareButton,
  WhatsappShareButton,
  LinkedinShareButton,
  TelegramShareButton,
  EmailShareButton,
  FacebookIcon,
  TwitterIcon,
  WhatsappIcon,
  LinkedinIcon,
  TelegramIcon,
  EmailIcon,
} from 'react-share';

interface ShareButtonsProps {
  url?: string;
  title?: string;
  size?: number;
  round?: boolean;
  className?: string;
}

const ShareButtons: React.FC<ShareButtonsProps> = ({
  url,
  title = '',
  size = 32,
  round = true,
  className = '',
}) => {
  // Use current page URL if not provided
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-1 uppercase tracking-widest">
        Share
      </span>
      <FacebookShareButton url={shareUrl}>
        <FacebookIcon size={size} round={round} />
      </FacebookShareButton>

      <TwitterShareButton url={shareUrl} title={title}>
        <TwitterIcon size={size} round={round} />
      </TwitterShareButton>

      <WhatsappShareButton url={shareUrl} title={title} separator=":: ">
        <WhatsappIcon size={size} round={round} />
      </WhatsappShareButton>

      <LinkedinShareButton url={shareUrl}>
        <LinkedinIcon size={size} round={round} />
      </LinkedinShareButton>

      <TelegramShareButton url={shareUrl} title={title}>
        <TelegramIcon size={size} round={round} />
      </TelegramShareButton>

      <EmailShareButton url={shareUrl} subject={title} body="Check this out:">
        <EmailIcon size={size} round={round} />
      </EmailShareButton>
    </div>
  );
};

export default ShareButtons;
