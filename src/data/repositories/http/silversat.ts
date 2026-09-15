/**
 * Direct calls into the vendor system.
 *
 * These are the support desk's tools, and they differ from every other
 * repository here in one way that matters: they reach past our database into
 * the receiver itself. Nothing is recorded locally, an answer is whatever the
 * vendor said, and a mistake is made on real hardware — which is why the
 * screen that uses them confirms before the two write actions.
 *
 * `recharge` is the exception that takes no region: the API resolves it from
 * the code's own product, and refuses a code that is not already sold to the
 * app user who owns the receiver.
 *
 * `regionForProvince` exists so that the read-only calls resolve the server
 * the same way `recharge` already does — from the catalogue — instead of from
 * whatever the operator happened to leave selected in a dropdown. Querying the
 * right receiver number against the wrong province's server answers
 * confidently and wrongly, which is the worst failure a support tool has.
 */

import { api } from '@/data/http/client';
import type { Id, RechargeType, SilversatRegion, VendorResponse } from '@/types';
import type { SilversatRepository } from '../types';
import { catalogScope } from './scope';

export class HttpSilversatRepository implements SilversatRepository {
  regions(): Promise<SilversatRegion[]> {
    return api.get<SilversatRegion[]>('/silversat/regions');
  }

  async regionForProvince(provinceId: Id): Promise<SilversatRegion | null> {
    const [scope, regions] = await Promise.all([catalogScope(), this.regions()]);
    // First wins when a province is misconfigured across two servers. The
    // province screen is where that fault is surfaced; a support call still
    // has to reach *a* server rather than refuse to run.
    const [regionId] = scope.regionIdsOf(provinceId);
    return regions.find((row) => row.id === regionId) ?? null;
  }

  checkCode(regionId: Id, code: string): Promise<VendorResponse> {
    return api.post<VendorResponse>('/silversat/check-code', { regionId, code: code.trim() });
  }

  subscription(regionId: Id, deviceNumber: string): Promise<VendorResponse> {
    return api.post<VendorResponse>('/silversat/subscription', {
      regionId,
      deviceNumber: deviceNumber.trim(),
    });
  }

  sendSignal(regionId: Id, deviceNumber: string): Promise<VendorResponse> {
    return api.post<VendorResponse>('/silversat/send-signal', {
      regionId,
      deviceNumber: deviceNumber.trim(),
    });
  }

  recharge(deviceNumber: string, code: string, type: RechargeType): Promise<VendorResponse> {
    return api.post<VendorResponse>('/silversat/recharge', {
      deviceNumber: deviceNumber.trim(),
      code: code.trim(),
      rechargingType: type,
    });
  }
}
