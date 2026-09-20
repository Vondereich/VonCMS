import React, { useState } from 'react';
import SafeImage from '../../components/SafeImage';
import { normalizeImageSource } from '../../utils/siteUtils';

type ThemeImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string;
};

/**
 * Keeps the active theme's real image geometry visible while the bitmap decodes.
 * The parent owns the aspect ratio or fixed height; this component only fills that space.
 */
const ThemeImage: React.FC<ThemeImageProps> = ({ src, className = '', onLoad, ...props }) => {
  const safeSrc = normalizeImageSource(src);
  const sourceKey = `${safeSrc}\u0000${typeof props.srcSet === 'string' ? props.srcSet : ''}`;
  const [imageState, setImageState] = useState<{
    sourceKey: string;
    status: 'loading' | 'loaded' | 'failed';
  }>(() => ({ sourceKey, status: safeSrc ? 'loading' : 'failed' }));
  const loadState = safeSrc
    ? imageState.sourceKey === sourceKey
      ? imageState.status
      : 'loading'
    : 'failed';

  const handleLoad: React.ReactEventHandler<HTMLImageElement> = (event) => {
    setImageState({ sourceKey, status: 'loaded' });
    onLoad?.(event);
  };

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    setImageState({ sourceKey, status: 'failed' });
    props.onError?.(event);
  };

  return (
    <>
      <span className={`voncms-theme-image-placeholder is-${loadState}`} aria-hidden="true" />
      <SafeImage
        {...props}
        src={safeSrc}
        onLoad={handleLoad}
        onError={handleError}
        className={`voncms-theme-image ${className}`.trim()}
      />
    </>
  );
};

export default ThemeImage;
