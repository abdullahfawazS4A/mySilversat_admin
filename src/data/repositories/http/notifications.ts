/**
 * Push notifications.
 *
 * There are no drafts and no scheduling on this API: `POST /notifications/send`
 * delivers and records in one step, so the composer's submit button is
 * irreversible and the screen says so before it fires.
 *
 * Every push is bilingual — Arabic and Kurdish are both required by the DTO,
 * so the composer cannot let one of them be blank.
 */

import { api, fetchAll } from '@/data/http/client';
import { provinceOfUser } from '@/types';
import type { AppUser, Id, ListQuery, NotificationRecord, NotificationTarget, Page } from '@/types';
import type { NotificationInput, NotificationsRepository } from '../types';
import { toPage, toRange } from './crud';

export class HttpNotificationsRepository implements NotificationsRepository {
  async list(query?: ListQuery): Promise<Page<NotificationRecord>> {
    const result = await api.page<NotificationRecord>('/notifications', toRange(query));
    return toPage(result.items, result.total, query);
  }

  get(id: Id): Promise<NotificationRecord> {
    return api.get<NotificationRecord>(`/notifications/${id}`);
  }

  send(input: NotificationInput): Promise<NotificationRecord> {
    return api.post<NotificationRecord>('/notifications/send', input);
  }

  /**
   * How many app users the chosen target covers.
   *
   * Counted from the user list because the API exposes no audience-size route.
   * It is an upper bound on reach, not on delivery: a user without an FCM
   * token is counted here and will show up in the send's `failureCount`.
   */
  async audienceSize(targetType: NotificationTarget, provinceId?: Id): Promise<number> {
    if (targetType === 'user') return 1;
    const users = await fetchAll<AppUser>('/app-users');
    const reachable = users.filter((user) => !user.isBlocked);
    if (targetType === 'province' && provinceId) {
      return reachable.filter((user) => provinceOfUser(user) === provinceId).length;
    }
    return reachable.length;
  }
}
