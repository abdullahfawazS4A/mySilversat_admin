/**
 * Push notifications.
 *
 * There are no drafts and no scheduling on this API: `POST /notifications/send`
 * delivers and records in one step, so the composer's submit button is
 * irreversible and the screen says so before it fires.
 *
 * Every push is bilingual — Arabic and Kurdish are both required by the DTO,
 * so the composer cannot let one of them be blank.
 *
 * A sent notification can be edited or deleted afterwards, but only its copy in
 * the app's inbox (`/notifications/me`) changes: the push already on phones
 * stays as it was delivered.
 */

import { api } from '@/data/http/client';
import type { Id, ListQuery, NotificationRecord, NotificationTarget, Page } from '@/types';
import type { NotificationInput, NotificationTextInput, NotificationsRepository } from '../types';
import { clean, toPage, toRange } from './crud';

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

  update(id: Id, input: NotificationTextInput): Promise<NotificationRecord> {
    return api.patch<NotificationRecord>(`/notifications/${id}`, input);
  }

  async remove(id: Id): Promise<void> {
    await api.delete(`/notifications/${id}`);
  }

  /**
   * How many app users the chosen target reaches.
   *
   * `/notifications/audience` counts users with an FCM token, which is who a
   * push can actually land on — tighter than counting every unblocked user.
   */
  async audienceSize(targetType: NotificationTarget, provinceId?: Id): Promise<number> {
    if (targetType === 'user') return 1;
    if (targetType === 'province' && !provinceId) return 0;
    const result = await api.get<{ count: number }>(
      '/notifications/audience',
      clean({ targetType, provinceId: targetType === 'province' ? provinceId : undefined }),
    );
    return result.count;
  }
}
