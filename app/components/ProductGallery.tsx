import {useEffect, useState} from 'react';
import {Image} from '@shopify/hydrogen';

type GalleryImage = {
  id?: string | null;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
};

export function ProductGallery({
  images,
  title,
}: {
  images: GalleryImage[];
  title: string;
}) {
  const [active, setActive] = useState(0);

  // Reset when the image set changes (e.g. variant switch)
  useEffect(() => {
    setActive(0);
  }, [images.length, images[0]?.url]);

  if (!images.length) {
    return <div className="aspect-square w-full rounded-2xl bg-neutral-100" />;
  }

  const current = images[active];
  const go = (dir: number) =>
    setActive((i) => (i + dir + images.length) % images.length);

  return (
    <div className="flex flex-col gap-4">
      {/* Main image */}
      <div className="group relative aspect-square w-full overflow-hidden rounded-2xl bg-neutral-50">
        <Image
          alt={current.altText || title}
          aspectRatio="1/1"
          data={current}
          key={current.url}
          sizes="(min-width: 45em) 50vw, 100vw"
          className="h-full w-full object-cover"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Immagine precedente"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-neutral-800 shadow-sm backdrop-blur transition hover:bg-white opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Immagine successiva"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-neutral-800 shadow-sm backdrop-blur transition hover:bg-white opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
              {active + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((img, i) => (
            <button
              type="button"
              key={img.url}
              aria-label={`Vai all'immagine ${i + 1}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
              className={`aspect-square overflow-hidden rounded-lg bg-neutral-50 ring-2 transition ${
                i === active
                  ? 'ring-neutral-900'
                  : 'ring-transparent hover:ring-neutral-300'
              }`}
            >
              <Image
                alt={img.altText || `${title} ${i + 1}`}
                aspectRatio="1/1"
                data={img}
                sizes="120px"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
