/**
 * Countries and provinces.
 *
 * Reference data everything else joins against: a product belongs to a
 * province, a province to a country. Neither collection is large, so both are
 * searched client-side.
 *
 * `overview` is the exception that is not reference data at all. There is no
 * province summary route, and there is no province column on a code, a
 * category or a server — so the one view the business is actually run from
 * ("what does Ninawa own, sell and have left") has to be composed here out of
 * five list routes. It is a deliberate, one-shot read: the province screen
 * calls it once and pages over the result, never once per row.
 */

import { fetchAll } from '@/data/http/client';
import type {
  AppUser,
  Code,
  Country,
  Id,
  Province,
  ProvinceOverview,
  SilversatRegion,
} from '@/types';
import { toAmount } from '@/types';
import type { CountryInput, GeoRepository, ProvinceInput } from '../types';
import { HttpCrudRepository } from './crud';
import { catalogScope } from './scope';

class HttpCountriesRepository extends HttpCrudRepository<Country, CountryInput> {
  constructor() {
    super('/countries', (row) => `${row.name} ${row.code} ${row.currency}`);
  }
}

class HttpProvincesRepository extends HttpCrudRepository<
  Province,
  ProvinceInput,
  Partial<ProvinceInput>,
  { countryId?: Id }
> {
  constructor() {
    super('/provinces', (row) => `${row.name} ${row.code} ${row.country?.name ?? ''}`);
  }
}

/**
 * The last overview, memoised.
 *
 * It costs two full walks of `/codes` — a hundred-odd requests — and two
 * screens ask for it: the province table, and the stock screen the province
 * table links into. Reading it twice inside a few seconds because the operator
 * followed that link is the one case worth spending a cache on.
 */
const OVERVIEW_TTL_MS = 30_000;
let overviewCache: { at: number; rows: ProvinceOverview[] } | null = null;
let overviewInFlight: Promise<ProvinceOverview[]> | null = null;

export class HttpGeoRepository implements GeoRepository {
  readonly countries = new HttpCountriesRepository();
  readonly provinces = new HttpProvincesRepository();

  overview(): Promise<ProvinceOverview[]> {
    if (overviewCache && Date.now() - overviewCache.at < OVERVIEW_TTL_MS) {
      return Promise.resolve(overviewCache.rows);
    }
    if (overviewInFlight) return overviewInFlight;

    overviewInFlight = this.readOverview()
      .then((rows) => {
        overviewCache = { at: Date.now(), rows };
        return rows;
      })
      .finally(() => {
        overviewInFlight = null;
      });
    return overviewInFlight;
  }

  private async readOverview(): Promise<ProvinceOverview[]> {
    const [provinces, regions, scope, availableCodes, soldCodes, users] = await Promise.all([
      fetchAll<Province>('/provinces'),
      fetchAll<SilversatRegion>('/silversat-regions'),
      catalogScope(),
      fetchAll<Code>('/codes', { status: 'available' }, 10000),
      fetchAll<Code>('/codes', { status: 'sold' }, 10000),
      fetchAll<AppUser>('/app-users'),
    ]);

    const regionById = new Map(regions.map((row) => [row.id, row]));

    // The API's own binding, indexed the other way round: a server names its
    // province, so the province's claims have to be gathered rather than read.
    const claimsByProvince = new Map<Id, SilversatRegion[]>();
    for (const region of regions) {
      if (!region.provinceId) continue;
      const list = claimsByProvince.get(region.provinceId);
      if (list) list.push(region);
      else claimsByProvince.set(region.provinceId, [region]);
    }

    // Counted per category first, because the low-stock rule is a category's
    // own threshold — a province total cannot answer "which shelf is empty".
    const availableByCategory = new Map<Id, number>();
    for (const code of availableCodes) {
      availableByCategory.set(code.categoryId, (availableByCategory.get(code.categoryId) ?? 0) + 1);
    }

    const soldByProvince = new Map<Id, number>();
    for (const code of soldCodes) {
      const provinceId = scope.provinceOfCategory(code.categoryId);
      if (!provinceId) continue;
      soldByProvince.set(provinceId, (soldByProvince.get(provinceId) ?? 0) + 1);
    }

    const usersByProvince = new Map<Id, number>();
    for (const user of users) {
      usersByProvince.set(user.provinceId, (usersByProvince.get(user.provinceId) ?? 0) + 1);
    }

    return provinces.map((province) => {
      const products = scope.productsOf(province.id);
      const categories = scope.categoriesOf(province.id);

      let codesAvailable = 0;
      let lowStockCategories = 0;
      let stockValue = 0;
      for (const category of categories) {
        const count = availableByCategory.get(category.id) ?? 0;
        codesAvailable += count;
        stockValue += count * toAmount(category.unitPrice);
        if (category.lowStockThreshold !== null && count <= category.lowStockThreshold) {
          lowStockCategories += 1;
        }
      }

      return {
        province,
        regions: scope
          .regionIdsOf(province.id)
          .map((id) => regionById.get(id))
          .filter((row): row is SilversatRegion => Boolean(row)),
        claimedRegions: claimsByProvince.get(province.id) ?? [],
        unroutedProducts: products.filter(
          (product) => product.activationApi !== 'silvers' || !product.silversatRegionId,
        ).length,
        productCount: products.length,
        categoryCount: categories.length,
        codesAvailable,
        codesSold: soldByProvince.get(province.id) ?? 0,
        lowStockCategories,
        stockValue,
        userCount: usersByProvince.get(province.id) ?? 0,
      };
    });
  }
}
