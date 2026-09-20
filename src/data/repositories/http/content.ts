/**
 * Everything marketing edits inside the app: banners, FAQs, tutorial videos,
 * towers, contact channels and prize draws.
 *
 * They are plain REST collections sharing one convention — a bilingual pair for
 * every authored string — and most of them an `order` column the app sorts on.
 * The screens are built from the same editor for that reason.
 *
 * A prize draw sits here because that is all the API makes it: text, a date and
 * a switch. Holding the draw and recording a winner have no routes at all.
 */

import { api } from '@/data/http/client';
import type { Ad, ContactLink, Faq, Id, PrizeDraw, Tower, TutorialVideo } from '@/types';
import type {
  AdInput,
  ContactLinkInput,
  ContentRepository,
  CrudRepository,
  FaqInput,
  PrizeDrawInput,
  TowerInput,
  VideoInput,
} from '../types';
import { HttpCrudRepository } from './crud';

/**
 * Banners, the one resource the console saves as multipart rather than JSON.
 *
 * `/ads` takes the picture as a file on the same request that saves the
 * banner, and has no field for an image URL: measured against the live API, a
 * JSON create comes back `400 Ad image is required` however the link is
 * spelled. So the console cannot upload the file somewhere first and send a
 * link second — the two travel together, and the old two-step (upload to
 * `/uploads`, then POST the URL) could never have worked here. `/uploads`
 * answers `405`; it does not exist.
 *
 * An edit may leave the file out, and the server keeps the picture it has.
 */
class HttpAdsRepository extends HttpCrudRepository<Ad, AdInput, Partial<AdInput>> {
  constructor() {
    super('/ads', (row) => `${row.title} ${row.titleKu} ${row.province?.name ?? ''}`);
  }

  /**
   * The draft as multipart.
   *
   * Every field crosses as text, which is all a multipart part can be, and the
   * server parses it back: `'false'` arrives as `false`, `'7'` as `7`, and an
   * empty part as `null`. That was checked against the live API rather than
   * assumed — a banner that goes live when the operator said hidden is exactly
   * the bug nobody reports.
   *
   * `imageUrl` is left out on purpose: it is the form's copy of the picture
   * already stored, and there is nothing on the API to send it to.
   */
  private static form(input: Partial<AdInput>): FormData {
    const form = new FormData();
    const put = (key: string, value: string | number | boolean | null | undefined) => {
      // Absent means "not part of this edit"; null means "clear it".
      if (value === undefined) return;
      form.append(key, value === null ? '' : String(value));
    };

    put('title', input.title);
    put('titleKu', input.titleKu);
    put('actionType', input.actionType);
    put('actionValue', input.actionValue);
    put('order', input.order);
    put('isActive', input.isActive);
    put('provinceId', input.provinceId);
    if (input.image) form.append('image', input.image, input.image.name);
    return form;
  }

  create(input: AdInput): Promise<Ad> {
    return api.post<Ad>('/ads', HttpAdsRepository.form(input));
  }

  update(id: Id, input: Partial<AdInput>): Promise<Ad> {
    return api.patch<Ad>(`/ads/${id}`, HttpAdsRepository.form(input));
  }
}

export class HttpContentRepository implements ContentRepository {
  readonly ads: CrudRepository<Ad, AdInput> = new HttpAdsRepository();

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

  readonly prizeDraws: CrudRepository<PrizeDraw, PrizeDrawInput> = new HttpCrudRepository<
    PrizeDraw,
    PrizeDrawInput
  >('/prize-draws', (row) => `${row.titleAr} ${row.titleKu} ${row.bodyAr}`);
}
