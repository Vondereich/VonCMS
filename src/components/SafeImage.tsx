import React, { useState } from 'react';
import { normalizeImageSource } from '../utils/siteUtils';

type SafeImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string;
  fallback?: React.ReactNode;
};

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  fallback = null,
  onError,
  ...props
}) => {
  const [hasFailed, setHasFailed] = useState(false);
  const safeSrc = normalizeImageSource(src);

  if (!safeSrc || hasFailed) {
    return <>{fallback}</>;
  }

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    setHasFailed(true);
    onError?.(event);
  };

  const imageProps: React.ImgHTMLAttributes<HTMLImageElement> = {
    ...props,
    // lgtm[js/xss] SafeImage is the single image URL sink after normalizeImageSource fail-closed validation.
    // codeql[js/xss] normalizeImageSource rejects scriptable/non-image URL schemes before this audited sink.
    src: safeSrc,
    onError: handleError,
  };

  // lgtm[js/xss] imageProps.src is normalized above and unsafe values render the fallback instead.
  // codeql[js/xss] This createElement call is the centralized audited image sink for user-supplied images.
  return React.createElement('img', imageProps);
};

export default SafeImage;
