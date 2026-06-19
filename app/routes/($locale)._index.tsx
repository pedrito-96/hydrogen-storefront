import {Await, useLoaderData, Link} from 'react-router';
import type {Route} from './+types/($locale)._index';

import {Suspense} from 'react';
import {Image} from '@shopify/hydrogen';
import type {
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
} from 'storefrontapi.generated';
import {ProductItem} from '~/components/ProductItem';
import {MockShopNotice} from '~/components/MockShopNotice';

// SANITY
import {client, urlFor} from '~/sanity/client';
import type {Post} from '~/sanity/types';
import {PortableText} from '@portabletext/react';

const POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
]|order(publishedAt desc)[0...12]{_id, title, slug, publishedAt, body, image}`;

export const meta: Route.MetaFunction = () => {
  return [{title: 'Hydrogen | Home'}];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {
    ...deferredData,
    ...criticalData,
    posts: await client.fetch<Post[]>(POSTS_QUERY),
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: Route.LoaderArgs) {
  const [{collections}] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {
    isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN),
    featuredCollection: collections.nodes[0],
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error: Error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  return {
    recommendedProducts,
  };
}

export default function Homepage({loaderData}: Route.ComponentProps) {
  const {posts} = loaderData;
  const data = useLoaderData<typeof loader>();
  return (
    <div className="home">
      <h1 className="text-4xl font-bold mb-8">Posts from Sanity</h1>
      <ul className="mx-auto flex max-w-md flex-col gap-y-8">
        {posts.map((post) => (
          <li
            key={post._id}
            className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
          >
            <Link to={`/${post.slug?.current ?? ''}`} className="block">
              <header className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 text-sm font-semibold">{post.title}</div>
                <button
                  type="button"
                  aria-label="More"
                  className="text-neutral-500"
                >
                  ⋯
                </button>
              </header>
              {post.image && (
                <img
                  src={urlFor(post.image).width(1080).height(1080).url()}
                  alt={post.title ?? ''}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              )}
              <div className="px-4 py-2 text-sm">
                {post.body && (
                  <div className="text-sm">
                    <PortableText value={post.body} />
                  </div>
                )}
              </div>
              {post.publishedAt && (
                <div className="px-4 pb-3 text-xs uppercase tracking-wide text-neutral-500">
                  {new Date(post.publishedAt).toLocaleDateString('en-US')}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {data.isShopLinked ? null : <MockShopNotice />}
      <FeaturedCollection collection={data.featuredCollection} />
      <RecommendedProducts products={data.recommendedProducts} />
    </div>
  );
}

function FeaturedCollection({
  collection,
}: {
  collection: FeaturedCollectionFragment;
}) {
  if (!collection) return null;
  const image = collection?.image;
  return (
    <Link
      className="featured-collection"
      to={`/collections/${collection.handle}`}
    >
      {image && (
        <div className="featured-collection-image">
          <Image
            data={image}
            sizes="100vw"
            alt={image.altText || collection.title}
          />
        </div>
      )}
      <h1>{collection.title}</h1>
    </Link>
  );
}

function RecommendedProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery | null>;
}) {
  return (
    <section
      className="recommended-products"
      aria-labelledby="recommended-products"
    >
      <h2 id="recommended-products">Recommended Products</h2>
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={products}>
          {(response) => (
            <div className="recommended-products-grid">
              {response
                ? response.products.nodes.map((product) => (
                    <ProductItem key={product.id} product={product} />
                  ))
                : null}
            </div>
          )}
        </Await>
      </Suspense>
      <br />
    </section>
  );
}

const FEATURED_COLLECTION_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    image {
      id
      url
      altText
      width
      height
    }
    handle
  }
  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 1, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...FeaturedCollection
      }
    }
  }
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    featuredImage {
      id
      url
      altText
      width
      height
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 4, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
