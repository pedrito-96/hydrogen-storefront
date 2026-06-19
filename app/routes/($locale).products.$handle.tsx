import {redirect, useLoaderData} from 'react-router';
import type {Route} from './+types/products.$handle';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductGallery} from '~/components/ProductGallery';
import {ProductForm} from '~/components/ProductForm';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';

export const meta: Route.MetaFunction = ({data}) => {
  return [
    {title: `Hydrogen | ${data?.product.title ?? ''}`},
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  return {
    product,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context, params}: Route.LoaderArgs) {
  // Put any API calls that is not critical to be available on first page render
  // For example: product reviews, product recommendations, social feeds.

  return {};
}

export default function Product() {
  const {product} = useLoaderData<typeof loader>();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml, vendor} = product;

  // Build the gallery: product images, fall back to the selected variant image
  const galleryImages =
    product.images?.nodes?.length
      ? product.images.nodes
      : selectedVariant?.image
        ? [selectedVariant.image]
        : [];

  // Product specs sourced from metafields
  const specs = [
    {label: 'Collezione', value: product.collezione?.value},
    {label: 'Materiale', value: product.materiale?.value},
    {label: 'Tipo pietra', value: product.tipoPietra?.value},
    {label: 'Caratura', value: selectedVariant?.caratura?.value},
    {label: 'SKU', value: selectedVariant?.sku},
  ].filter((s) => s.value);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-8 md:grid-cols-2 md:gap-14">
      <div className="md:sticky md:top-24 md:self-start">
        <ProductGallery images={galleryImages} title={title} />
      </div>

      <div className="flex flex-col">
        {vendor && (
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            {vendor}
          </span>
        )}
        <h1 className="mt-1 text-3xl font-semibold leading-tight text-neutral-900">
          {title}
        </h1>

        <div className="mt-4 text-2xl font-medium text-neutral-900">
          <ProductPrice
            price={selectedVariant?.price}
            compareAtPrice={selectedVariant?.compareAtPrice}
          />
        </div>

        <div className="mt-6 border-t border-neutral-200 pt-6">
          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
          />
        </div>

        {specs.length > 0 && (
          <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-neutral-200 pt-6 sm:grid-cols-2">
            {specs.map((s) => (
              <div key={s.label} className="flex justify-between gap-4 sm:block">
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {s.label}
                </dt>
                <dd className="text-sm text-neutral-900 sm:mt-0.5">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {descriptionHtml && (
          <div className="mt-8 border-t border-neutral-200 pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-900">
              Descrizione
            </h2>
            <div
              className="prose prose-neutral mt-3 max-w-none text-sm leading-relaxed text-neutral-700"
              dangerouslySetInnerHTML={{__html: descriptionHtml}}
            />
          </div>
        )}
      </div>
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
    caratura: metafield(namespace: "custom", key: "caratura") {
      value
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    images(first: 20) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
    materiale: metafield(namespace: "custom", key: "materiale") {
      value
    }
    tipoPietra: metafield(namespace: "custom", key: "tipo_pietra") {
      value
    }
    collezione: metafield(namespace: "custom", key: "collezione") {
      value
    }
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;
