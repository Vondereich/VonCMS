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

  // lgtm[js/xss] SafeImage is the single image URL sink after normalizeImageSource fail-closed validation.
  return (
    <img
      {...props}
      src={safeSrc}
      onError={(event) => {
        setHasFailed(true);
        onError?.(event);
      }}
    />
  );
};

export default SafeImage;
