import {Link, useSearchParams} from 'react-router';
import {Image, Money, Pagination} from '@shopify/hydrogen';
import {urlWithTrackingParams, type RegularSearchReturn} from '~/lib/search';

type SearchItems = RegularSearchReturn['result']['items'];
type ProductFacets = NonNullable<SearchItems['products']>['productFilters'];
type PartialSearchResult<ItemType extends keyof SearchItems> = Pick<
  SearchItems,
  ItemType
> &
  Pick<RegularSearchReturn, 'term'>;

type SearchResultsProps = RegularSearchReturn & {
  children: (args: SearchItems & {term: string}) => React.ReactNode;
};

export function SearchResults({
  term,
  result,
  children,
}: Omit<SearchResultsProps, 'error' | 'type'>) {
  if (!result?.total) {
    return null;
  }

  return children({...result.items, term});
}

SearchResults.Articles = SearchResultsArticles;
SearchResults.Pages = SearchResultsPages;
SearchResults.Products = SearchResultsProducts;
SearchResults.Filters = SearchResultsFilters;
SearchResults.Empty = SearchResultsEmpty;

/** Normalise a facet value `input` (string or object) to a JSON string. */
function inputKey(input: unknown): string {
  return typeof input === 'string' ? input : JSON.stringify(input);
}

/**
 * Renders the facets returned by the Storefront search API. List facets (e.g.
 * Availability, Materiale) render as checkboxes; PRICE_RANGE facets render as a
 * min/max range. Each applied facet value is stored in the URL as a `filter`
 * param holding the JSON `input` the API returned — the loader parses these
 * back into `productFilters` for the search query.
 */
function SearchResultsFilters({filters}: {filters?: ProductFacets}) {
  const [searchParams, setSearchParams] = useSearchParams();

  if (!filters?.length) {
    return null;
  }

  /** Replace the `filter` params, resetting pagination. */
  function commitFilters(values: string[]) {
    const next = new URLSearchParams(searchParams);
    next.delete('filter');
    for (const v of values) next.append('filter', v);
    next.delete('cursor');
    next.delete('direction');
    setSearchParams(next, {preventScrollReset: true});
  }

  const current = searchParams.getAll('filter');
  const applied = new Set(current);

  function toggleFilter(input: string, checked: boolean) {
    const values = current.filter((v) => v !== input);
    if (checked) values.push(input);
    commitFilters(values);
  }

  function setPriceFilter(min?: number, max?: number) {
    // Drop any existing price filter, then add the new one (if any bound set).
    const values = current.filter((v) => {
      try {
        return !('price' in (JSON.parse(v) as Record<string, unknown>));
      } catch {
        return true;
      }
    });
    if (min != null || max != null) {
      const price: {min?: number; max?: number} = {};
      if (min != null) price.min = min;
      if (max != null) price.max = max;
      values.push(JSON.stringify({price}));
    }
    commitFilters(values);
  }

  return (
    <div className="search-filters">
      {filters.map((filter) => (
        <fieldset className="search-filter" key={filter.id}>
          <legend>{filter.label}</legend>
          {filter.type === 'PRICE_RANGE' ? (
            <PriceRangeFilter
              values={current}
              bounds={filter.values[0]?.input}
              onApply={setPriceFilter}
            />
          ) : (
            filter.values.map((value) => {
              const input = inputKey(value.input);
              return (
                <label className="search-filter-value" key={value.id}>
                  <input
                    type="checkbox"
                    checked={applied.has(input)}
                    onChange={(event) =>
                      toggleFilter(input, event.target.checked)
                    }
                  />
                  <span>{value.label}</span>
                  {typeof value.count === 'number' && (
                    <small>&nbsp;({value.count})</small>
                  )}
                </label>
              );
            })
          )}
        </fieldset>
      ))}
    </div>
  );
}

type PriceInput = {price?: {min?: number; max?: number}};

function PriceRangeFilter({
  values,
  bounds,
  onApply,
}: {
  values: string[];
  bounds: unknown;
  onApply: (min?: number, max?: number) => void;
}) {
  // Available price range advertised by the facet, used as placeholders.
  const boundsParsed = parsePrice(bounds);
  // Currently-applied price filter, if any.
  const appliedPrice = values
    .map(parsePrice)
    .find((p): p is NonNullable<typeof p> => p != null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const read = (name: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      return el?.value ? Number(el.value) : undefined;
    };
    onApply(read('minPrice'), read('maxPrice'));
  }

  return (
    <form className="search-filter-price" onSubmit={onSubmit}>
      <label>
        Min
        <input
          type="number"
          name="minPrice"
          min={0}
          defaultValue={appliedPrice?.min ?? ''}
          placeholder={boundsParsed?.min?.toString() ?? '0'}
        />
      </label>
      <label>
        Max
        <input
          type="number"
          name="maxPrice"
          min={0}
          defaultValue={appliedPrice?.max ?? ''}
          placeholder={boundsParsed?.max?.toString() ?? ''}
        />
      </label>
      <button type="submit">Apply</button>
      {appliedPrice && (
        <button type="button" onClick={() => onApply(undefined, undefined)}>
          Clear
        </button>
      )}
    </form>
  );
}

function parsePrice(input: unknown): {min?: number; max?: number} | null {
  try {
    const parsed =
      typeof input === 'string' ? (JSON.parse(input) as PriceInput) : null;
    return parsed?.price ?? null;
  } catch {
    return null;
  }
}

function SearchResultsArticles({
  term,
  articles,
}: PartialSearchResult<'articles'>) {
  if (!articles?.nodes.length) {
    return null;
  }

  return (
    <div className="search-result">
      <h2>Articles</h2>
      <div>
        {articles?.nodes?.map((article) => {
          const articleUrl = urlWithTrackingParams({
            baseUrl: `/blogs/${article.handle}`,
            trackingParams: article.trackingParameters,
            term,
          });

          return (
            <div className="search-results-item" key={article.id}>
              <Link prefetch="intent" to={articleUrl}>
                {article.title}
              </Link>
            </div>
          );
        })}
      </div>
      <br />
    </div>
  );
}

function SearchResultsPages({term, pages}: PartialSearchResult<'pages'>) {
  if (!pages?.nodes.length) {
    return null;
  }

  return (
    <div className="search-result">
      <h2>Pages</h2>
      <div>
        {pages?.nodes?.map((page) => {
          const pageUrl = urlWithTrackingParams({
            baseUrl: `/pages/${page.handle}`,
            trackingParams: page.trackingParameters,
            term,
          });

          return (
            <div className="search-results-item" key={page.id}>
              <Link prefetch="intent" to={pageUrl}>
                {page.title}
              </Link>
            </div>
          );
        })}
      </div>
      <br />
    </div>
  );
}

function SearchResultsProducts({
  term,
  products,
}: PartialSearchResult<'products'>) {
  if (!products?.nodes.length) {
    return null;
  }

  return (
    <div className="search-result">
      <h2>Products</h2>
      <Pagination connection={products}>
        {({nodes, isLoading, NextLink, PreviousLink}) => {
          const ItemsMarkup = nodes.map((product) => {
            const productUrl = urlWithTrackingParams({
              baseUrl: `/products/${product.handle}`,
              trackingParams: product.trackingParameters,
              term,
            });

            const price = product?.selectedOrFirstAvailableVariant?.price;
            const image = product?.selectedOrFirstAvailableVariant?.image;

            return (
              <div className="search-results-item" key={product.id}>
                <Link prefetch="intent" to={productUrl}>
                  {image && (
                    <Image data={image} alt={product.title} width={50} />
                  )}
                  <div>
                    <p>{product.title}</p>
                    <small>{price && <Money data={price} />}</small>
                  </div>
                </Link>
              </div>
            );
          });

          return (
            <div>
              <div>
                <PreviousLink>
                  {isLoading ? 'Loading...' : <span>↑ Load previous</span>}
                </PreviousLink>
              </div>
              <div>
                {ItemsMarkup}
                <br />
              </div>
              <div>
                <NextLink>
                  {isLoading ? 'Loading...' : <span>Load more ↓</span>}
                </NextLink>
              </div>
            </div>
          );
        }}
      </Pagination>
      <br />
    </div>
  );
}

function SearchResultsEmpty() {
  return <p>No results, try a different search.</p>;
}
