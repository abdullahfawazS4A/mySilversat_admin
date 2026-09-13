/**
 * Products and categories — the price list.
 *
 * A product is one service in one province; a category is a purchasable
 * variant of it carrying four prices (cost, list, main-tier, sub-tier). Codes
 * hang off categories, which is what makes stock provincial without any
 * province column on the code itself.
 */

import { api } from '@/data/http/client';
import type { Category, Id, Product } from '@/types';
import type {
  CatalogRepository,
  CategoryInput,
  CrudRepository,
  ProductInput,
} from '../types';
import { HttpCrudRepository } from './crud';

class HttpProductsRepository extends HttpCrudRepository<Product, ProductInput> {
  constructor() {
    super(
      '/products',
      (row) => `${row.displayName} ${row.name} ${row.province?.name ?? ''} ${row.silversatRegion?.name ?? ''}`,
    );
  }

  /** One request that creates the product and every price tier under it. */
  createWithCategories(
    input: ProductInput & { categories: Omit<CategoryInput, 'productId'>[] },
  ): Promise<Product> {
    return api.post<Product>('/products/with-categories', input);
  }
}

class HttpCategoriesRepository extends HttpCrudRepository<
  Category,
  CategoryInput,
  Partial<CategoryInput>,
  { productId?: Id }
> {
  constructor() {
    super('/categories', (row) => `${row.name} ${row.nameKu} ${row.product?.displayName ?? ''}`);
  }
}

export class HttpCatalogRepository implements CatalogRepository {
  readonly products = new HttpProductsRepository();
  readonly categories: CrudRepository<
    Category,
    CategoryInput,
    Partial<CategoryInput>,
    { productId?: Id }
  > = new HttpCategoriesRepository();
}
