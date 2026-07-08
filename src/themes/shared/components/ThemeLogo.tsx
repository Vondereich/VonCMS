export const LOGO_SLOT_CLASS = 'w-[112px] h-[38px] sm:w-[140px] sm:h-[45px]';
export const LOGO_TITLE_SLOT_CLASS = 'w-[150px] h-[48px] sm:w-[180px] sm:h-[56px]';
export const LOGO_IMAGE_CLASS = 'max-w-full max-h-full w-auto h-auto object-contain';

type ThemeLogoProps = {
  src: string;
  alt: string;
  useLogoAsTitle?: boolean;
  invertLogoInDarkMode?: boolean;
  className?: string;
  imageClassName?: string;
};

export default function ThemeLogo({
  src,
  alt,
  useLogoAsTitle = false,
  invertLogoInDarkMode = false,
  className = '',
  imageClassName = '',
}: ThemeLogoProps) {
  const slotClass = useLogoAsTitle ? LOGO_TITLE_SLOT_CLASS : LOGO_SLOT_CLASS;
  const darkModeInvertClass = invertLogoInDarkMode ? 'dark:brightness-0 dark:invert' : '';

  return (
    <span
      className={`${slotClass} inline-flex items-center justify-start flex-shrink-0 ${className}`}
    >
      <img
        src={src}
        alt={alt}
        className={`${LOGO_IMAGE_CLASS} ${darkModeInvertClass} ${imageClassName}`}
      />
    </span>
  );
}
