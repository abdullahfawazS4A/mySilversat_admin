/**
 * Countries and provinces.
 *
 * Reference data everything else joins against: a SilverSat server belongs
 * to a province, a province to a country. Neither collection is large, so both are
 * searched client-side.
 *
 * `overview` is the exception that is not reference data at all: what each
 * province owns, sells and has left. `/provinces/overview` counts it on the
 * server; the servers themselves and the catalogue split (categories, and
 * products whose activation bypasses SilverSat) come from the small reference
 * reads, which the route does not return.
 */

import { api, fetchAll } from '@/data/http/client';
import type { Country, Id, Province, ProvinceOverview, SilversatRegion } from '@/types';
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

/** A row of `/provinces/overview`, as measured against the live API. */
interface ProvinceCounts {
  provinceId: Id;
  provinceName: string;
  usersCount: number;
  regionsCount: number;
  productsCount: number;
  codesAvailable: number;
  codesSold: number;
  stockValue: number | string;
  lowStockCategoriesCount: number;
}

/**
 * The last overview, memoised.
 *
 * Two screens ask for it: the province table, and the stock screen the
 * province table links into. Reading it twice inside a few seconds because the
 * operator followed that link is not worth the requests.
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
    const [counts, provinces, regions, scope] = await Promise.all([
      api.get<ProvinceCounts[]>('/provinces/overview'),
      fetchAll<Province>('/provinces'),
      fetchAll<SilversatRegion>('/silversat-regions'),
      catalogScope(),
    ]);

    const countsOf = new Map(counts.map((row) => [row.provinceId, row]));

    // A server names its province, so a province's servers are gathered.
    const regionsByProvince = new Map<Id, SilversatRegion[]>();
    for (const region of regions) {
      if (!region.provinceId) continue;
      const list = regionsByProvince.get(region.provinceId);
      if (list) list.push(region);
      else regionsByProvince.set(region.provinceId, [region]);
    }

    return provinces.map((province) => {
      const row = countsOf.get(province.id);
      const products = scope.productsOf(province.id);
      return {
        province,
        regions: regionsByProvince.get(province.id) ?? [],
        unroutedProducts: products.filter((product) => product.activationApi !== 'silvers').length,
        productCount: row?.productsCount ?? products.length,
        categoryCount: scope.categoriesOf(province.id).length,
        codesAvailable: row?.codesAvailable ?? 0,
        codesSold: row?.codesSold ?? 0,
        lowStockCategories: row?.lowStockCategoriesCount ?? 0,
        stockValue: Number(row?.stockValue ?? 0),
        userCount: row?.usersCount ?? 0,
      };
    });
  }
}
