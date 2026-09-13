/**
 * Countries and provinces.
 *
 * Reference data everything else joins against: a product belongs to a
 * province, a province to a country. Neither collection is large, so both are
 * searched client-side.
 */

import type { Country, Id, Province } from '@/types';
import type { CountryInput, GeoRepository, ProvinceInput } from '../types';
import { HttpCrudRepository } from './crud';

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

export class HttpGeoRepository implements GeoRepository {
  readonly countries = new HttpCountriesRepository();
  readonly provinces = new HttpProvincesRepository();
}
