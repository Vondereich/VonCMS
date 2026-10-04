// Shared readable foreground for configurable theme accents.
export const getReadableForeground = (color: string): string => {
  const compactHex = color.trim().replace(/^#/, '');
  const normalizedHex =
    compactHex.length === 3
      ? compactHex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : compactHex;
  if (!/^[0-9a-f]{6}$/i.test(normalizedHex)) return '#ffffff';
  const channels = [0, 2, 4].map((offset) => parseInt(normalizedHex.slice(offset, offset + 2), 16));
  const [red, green, blue] = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.055;
  return whiteContrast >= darkContrast ? '#ffffff' : '#111827';
};
