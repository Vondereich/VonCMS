import React from 'react';
import { Copy, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { copyShareUrl, getCleanShareUrl } from '../utils/share';
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
  const shareUrl = getCleanShareUrl(url);
  const canShareNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const actionClassName = `inline-flex items-center justify-center bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 ${round ? 'rounded-full' : 'rounded-md'}`;

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      if (await copyShareUrl(shareUrl)) {
        toast.success('Link copied');
      } else {
        toast.error('Could not copy link');
      }
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleNativeShare = async () => {
    if (!shareUrl || !canShareNative) return;
    try {
      await navigator.share({ title, url: shareUrl });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      toast.error('Could not open sharing. Try Copy Link.');
    }
  };

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-1 uppercase tracking-widest">
        Share
      </span>
      {canShareNative && (
        <button
          type="button"
          onClick={handleNativeShare}
          className={actionClassName}
          style={{ width: size, height: size }}
          aria-label="Share using this device"
          title="Share using this device"
        >
          <Share2 size={Math.round(size * 0.5)} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className={actionClassName}
        style={{ width: size, height: size }}
        aria-label="Copy link"
        title="Copy link"
      >
        <Copy size={Math.round(size * 0.5)} aria-hidden="true" />
      </button>
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
