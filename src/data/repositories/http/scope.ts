/**
 * Province scoping.
 *
 * A code carries no province, and neither does anything it hangs off until
 * the very end of the chain: code → category → product → SilverSat server →
 * province. So "the stock of Ninawa" is a join the API cannot do for us. Every
 * province filter in the console resolves through here instead: read the two
 * catalogue tables once, build the product→province and category→province
 * maps, and apply them over fetched rows.
 *
 * The product read embeds its server with the server's `provinceId`, which is
 * what makes one read enough. A category's nested product does not embed it,
 * so categories are placed through the product map rather than their own row.
 *
 * A product whose server names no province is in no province. That is a
 * server misconfiguration and the province screen surfaces it; here it simply
 * drops out of every province's lists.
 *
 * Products and categories are small and change rarely, so the maps are
 * memoised for a minute rather than re-read on every keystroke of a search.
 */

import { fetchAll } from '@/data/http/client';
import { provinceOfProduct, type Category, type Id, type Product } from '@/types';

/** How long a built scope is reused before the tables are read again. */
const SCOPE_TTL_MS = 60_000;

/** The resolved joins, with the lookups every caller actually wants. */
export interface CatalogScope {
  products: Product[];
  categories: Category[];
  /** Products of one province. */
  productsOf(provinceId: Id): Product[];
  /** Categories of one province, through its products. */
  categoriesOf(provinceId: Id): Category[];
  /** The category ids a province owns — the set a code is tested against. */
  categoryIdsOf(provinceId: Id): Set<Id>;
  /** Which province a category belongs to, or undefined if it is orphaned. */
  provinceOfCategory(categoryId: Id): Id | undefined;
}

let cached: { at: number; scope: CatalogScope } | null = null;
let inFlight: Promise<CatalogScope> | null = null;

function build(products: Product[], categories: Category[]): CatalogScope {
  const byProvince = new Map<Id, Product[]>();
  const provinceOf = new Map<Id, Id>();
  for (const product of products) {
    const provinceId = provinceOfProduct(product);
    if (!provinceId) continue;
    provinceOf.set(product.id, provinceId);
    const list = byProvince.get(provinceId);
    if (list) list.push(product);
    else byProvince.set(provinceId, [product]);
  }

  const categoriesByProvince = new Map<Id, Category[]>();
  const provinceOfCategory = new Map<Id, Id>();
  for (const category of categories) {
    const provinceId = provinceOf.get(category.productId);
    if (!provinceId) continue;
    provinceOfCategory.set(category.id, provinceId);
    const list = categoriesByProvince.get(provinceId);
    if (list) list.push(category);
    else categoriesByProvince.set(provinceId, [category]);
  }

  // Built once rather than per call: the stock screen asks for the same
  // province's id set on every page, every filter change and every search.
  const idsByProvince = new Map<Id, Set<Id>>();
  for (const [provinceId, rows] of categoriesByProvince) {
    idsByProvince.set(provinceId, new Set(rows.map((row) => row.id)));
  }

  return {
    products,
    categories,
    productsOf: (provinceId) => byProvince.get(provinceId) ?? [],
    categoriesOf: (provinceId) => categoriesByProvince.get(provinceId) ?? [],
    categoryIdsOf: (provinceId) => idsByProvince.get(provinceId) ?? new Set<Id>(),
    provinceOfCategory: (categoryId) => provinceOfCategory.get(categoryId),
  };
}

/**
 * The scope, read at most once a minute.
 *
 * Concurrent callers share one read — the stock screen asks for it from both
 * of its tabs at mount, and two identical walks of `/products` is the kind of
 * waste a memo is supposed to prevent in the first place.
 */
export function catalogScope(): Promise<CatalogScope> {
  if (cached && Date.now() - cached.at < SCOPE_TTL_MS) return Promise.resolve(cached.scope);
  if (inFlight) return inFlight;

  inFlight = Promise.all([fetchAll<Product>('/products'), fetchAll<Category>('/categories')])
    .then(([products, categories]) => {
      const scope = build(products, categories);
      cached = { at: Date.now(), scope };
      return scope;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * Drops the memo.
 *
 * Called after a product or category is written, because the very next thing
 * an operator does with a new category is file stock against it — and a
 * minute of staleness there reads as the save having failed.
 */
export function invalidateCatalogScope(): void {
  cached = null;
}
