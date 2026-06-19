import {createClient} from '@sanity/client';
import {createImageUrlBuilder, type SanityImageSource} from '@sanity/image-url';

export const client = createClient({
  projectId: '5zn42sju',
  dataset: 'production',
  apiVersion: '2026-05-15',
  useCdn: false,
});

const builder = createImageUrlBuilder(client);

export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
