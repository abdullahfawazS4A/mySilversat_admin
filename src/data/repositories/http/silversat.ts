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
 */

import { api } from '@/data/http/client';
import type { Id, RechargeType, SilversatRegion, VendorResponse } from '@/types';
import type { SilversatRepository } from '../types';

export class HttpSilversatRepository implements SilversatRepository {
  regions(): Promise<SilversatRegion[]> {
    return api.get<SilversatRegion[]>('/silversat/regions');
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
