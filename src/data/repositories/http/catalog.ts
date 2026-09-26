/**
 * Products and categories — the price list.
 *
 * A product is one service on one SilverSat server; a category is a
 * purchasable variant of it carrying what it costs us and what the app sells
 * it for. Codes hang off categories and the server names a province, which is
 * what makes stock provincial without any province column on the code or the
 * product itself.
 *
 * Because those two facts are joined from here, every write drops the
 * memoised province maps. A new category whose stock screen cannot see it for
 * a minute reads as a save that failed.
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
import { invalidateCatalogScope } from './scope';

class HttpProductsRepository extends HttpCrudRepository<Product, ProductInput> {
  constructor() {
    super(
      '/products',
      (row) =>
        `${row.displayName} ${row.name} ${row.silversatRegion?.name ?? ''} ${row.silversatRegion?.province?.name ?? ''}`,
    );
  }

  async create(input: ProductInput): Promise<Product> {
    const product = await super.create(input);
    invalidateCatalogScope();
    return product;
  }

  async update(id: Id, input: Partial<ProductInput>): Promise<Product> {
    const product = await super.update(id, input);
    invalidateCatalogScope();
    return product;
  }

  async remove(id: Id): Promise<void> {
    await super.remove(id);
    invalidateCatalogScope();
  }

  /**
   * One request that creates the product and every price tier under it.
   *
   * A product with no category cannot be sold and cannot hold stock, so the
   * two are one decision — and two requests would leave that unsellable
   * product behind whenever the second one failed.
   */
  async createWithCategories(
    input: ProductInput & { categories: Omit<CategoryInput, 'productId'>[] },
  ): Promise<Product> {
    const product = await api.post<Product>('/products/with-categories', input);
    invalidateCatalogScope();
    return product;
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

  async create(input: CategoryInput): Promise<Category> {
    const category = await super.create(input);
    invalidateCatalogScope();
    return category;
  }

  async update(id: Id, input: Partial<CategoryInput>): Promise<Category> {
    const category = await super.update(id, input);
    invalidateCatalogScope();
    return category;
  }

  async remove(id: Id): Promise<void> {
    await super.remove(id);
    invalidateCatalogScope();
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
