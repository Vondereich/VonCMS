import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export const GlobalLightbox: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<string>('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Listen for image clicks in post content
  useEffect(() => {
    const handleImageClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Target images inside 'prose' (tailwind typography) or specific content areas
      const contentContainer = target.closest('.prose') || target.closest('.post-content');

      if (target.tagName === 'IMG' && contentContainer) {
        const img = target as HTMLImageElement;
        if (img.parentElement?.tagName === 'A') return; // Ignore linked images (optional)

        // Collect all images in the same container for gallery navigation
        const allImages = Array.from(contentContainer.querySelectorAll('img'))
          .map((img) => (img as HTMLImageElement).src)
          .filter((src) => src); // Filter empty

        const clickedSrc = img.src;
        const index = allImages.indexOf(clickedSrc);

        if (index !== -1) {
          setGallery(allImages);
          setCurrentIndex(index);
          setCurrentImage(clickedSrc);
          setIsOpen(true);
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    document.addEventListener('click', handleImageClick);
    return () => document.removeEventListener('click', handleImageClick);
  }, []);

  // Keyboard Navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, gallery]);

  const close = () => setIsOpen(false);

  const next = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % gallery.length);
    setCurrentImage(gallery[(currentIndex + 1) % gallery.length]);
  }, [gallery, currentIndex]);

  const prev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
    setCurrentImage(gallery[(currentIndex - 1 + gallery.length) % gallery.length]);
  }, [gallery, currentIndex]);

  // Sync currentImage with index when it changes
  useEffect(() => {
    if (gallery.length > 0) {
      setCurrentImage(gallery[currentIndex]);
    }
  }, [currentIndex, gallery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      {/* Controls */}
      <button
        onClick={close}
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors z-50"
      >
        <X size={32} />
      </button>

      {/* Navigation */}
      {gallery.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-4 hover:bg-white/10 rounded-full transition-colors z-50 hidden md:block"
          >
            <ChevronLeft size={48} />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-4 hover:bg-white/10 rounded-full transition-colors z-50 hidden md:block"
          >
            <ChevronRight size={48} />
          </button>
        </>
      )}

      {/* Image */}
      <div className="relative max-w-full max-h-screen p-4 flex items-center justify-center">
        <img
          src={currentImage}
          alt={`Gallery ${currentIndex + 1}`}
          className="max-w-full max-h-[90vh] object-contain shadow-2xl rounded-sm select-none"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Counter */}
        {gallery.length > 1 && (
          <div className="absolute bottom-[-40px] left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
            {currentIndex + 1} / {gallery.length}
          </div>
        )}
      </div>

      {/* Overlay Click to Close */}
      <div className="absolute inset-0 -z-10" onClick={close}></div>
    </div>
  );
};
