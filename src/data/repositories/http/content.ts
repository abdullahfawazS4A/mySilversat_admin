/**
 * Everything marketing edits inside the app: banners, FAQs, tutorial videos,
 * towers and contact channels.
 *
 * All five are plain REST collections that share two conventions — an `order`
 * column the app sorts on, and a bilingual pair for every authored string. The
 * screens are built from the same editor for that reason.
 */

import type { Ad, ContactLink, Faq, Id, Tower, TutorialVideo } from '@/types';
import type {
  AdInput,
  ContactLinkInput,
  ContentRepository,
  CrudRepository,
  FaqInput,
  TowerInput,
  VideoInput,
} from '../types';
import { HttpCrudRepository } from './crud';

export class HttpContentRepository implements ContentRepository {
  readonly ads: CrudRepository<Ad, AdInput> = new HttpCrudRepository<Ad, AdInput>(
    '/ads',
    (row) => `${row.title} ${row.titleKu} ${row.province?.name ?? ''}`,
  );

  readonly faqs: CrudRepository<Faq, FaqInput> = new HttpCrudRepository<Faq, FaqInput>(
    '/faqs',
    (row) => `${row.question} ${row.questionKu} ${row.answer}`,
  );

  readonly videos: CrudRepository<TutorialVideo, VideoInput> = new HttpCrudRepository<
    TutorialVideo,
    VideoInput
  >('/tutorial-videos', (row) => `${row.title} ${row.titleKu} ${row.subtitle ?? ''}`);

  readonly towers: CrudRepository<Tower, TowerInput, Partial<TowerInput>, { provinceId?: Id }> =
    new HttpCrudRepository<Tower, TowerInput, Partial<TowerInput>, { provinceId?: Id }>(
      '/towers',
      (row) => `${row.name} ${row.nameKu} ${row.province?.name ?? ''}`,
    );

  readonly contactLinks: CrudRepository<ContactLink, ContactLinkInput> = new HttpCrudRepository<
    ContactLink,
    ContactLinkInput
  >('/contact-links', (row) => `${row.label} ${row.labelKu} ${row.value} ${row.type}`);
}
