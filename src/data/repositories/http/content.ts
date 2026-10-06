/**
 * Everything marketing edits inside the app: banners, FAQs, tutorial videos,
 * towers, contact channels and prize draws.
 *
 * They are plain REST collections sharing one convention — a bilingual pair for
 * every authored string — and most of them an `order` column the app sorts on.
 * The screens are built from the same editor for that reason.
 *
 * A prize draw sits here because it is mostly text, a date and a switch. The
 * one thing more is holding the draw, which the server does in a single call.
 */

import { api } from '@/data/http/client';
import type { Ad, AdKind, ContactLink, Coupon, CouponStatus, Faq, Id, PrizeDraw, Tower, TutorialVideo } from '@/types';
import type {
  AdInput,
  ContactLinkInput,
  ContentRepository,
  CrudRepository,
  FaqInput,
  PrizeDrawInput,
  PrizeDrawsRepository,
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
class HttpAdsRepository extends HttpCrudRepository<Ad, AdInput, Partial<AdInput>, { type?: AdKind }> {
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
    put('type', input.type);
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

  /**
   * Saves, then reads the banner back to check its province.
   *
   * The API answers 200 to a province change it did not make: once a banner
   * has a province, moving it to another or clearing it keeps the old one, and
   * the PATCH reply still carries the old relation even when the change did
   * land. So neither the status nor the reply can be trusted here, and a read
   * is the only way to tell the operator the truth.
   */
  async update(id: Id, input: Partial<AdInput>): Promise<Ad> {
    await api.patch<Ad>(`/ads/${id}`, HttpAdsRepository.form(input));
    const saved = await this.get(id);
    if (input.provinceId !== undefined && (saved.provinceId ?? null) !== (input.provinceId ?? null)) {
      throw new Error(
        'انحفظت باقي التعديلات، بس الـ API ما غيّر المحافظة — تغيير محافظة إعلان عنده محافظة ما مدعوم من الباك إند حالياً',
      );
    }
    return saved;
  }
}

/**
 * Prize draws, plus the one route that holds the draw.
 *
 * `draw-winner` answers with the draw's bare columns, and only the single-draw
 * read joins the winning coupon, so the draw is read back after it is held to
 * give the screen the coupon's code rather than just its id.
 *
 * The routes take an optional picture as a multipart `image` part. A save with
 * no new picture still goes as JSON, the shape these routes have always taken,
 * so the multipart path only carries the cases that need it.
 */
class HttpPrizeDrawsRepository
  extends HttpCrudRepository<PrizeDraw, PrizeDrawInput>
  implements PrizeDrawsRepository
{
  constructor() {
    super('/prize-draws', (row) => `${row.titleAr} ${row.titleKu} ${row.bodyAr}`);
  }

  /** The draft as the server takes it: the file as multipart, otherwise JSON. */
  private static body(input: Partial<PrizeDrawInput>): FormData | Record<string, unknown> {
    // `imageUrl` is the form's copy of the stored picture and has nowhere to go.
    const { image, imageUrl: _shown, ...fields } = input;
    // The app stopped showing the body on 2026-10-06, so the form leaves it
    // optional — but `CreatePrizeDrawDto` still requires both halves. An empty
    // one is filled from its title, which the app does show, rather than
    // inventing text or tripping the validator.
    if ('bodyAr' in fields && !fields.bodyAr?.trim()) fields.bodyAr = fields.titleAr ?? '';
    if ('bodyKu' in fields && !fields.bodyKu?.trim()) fields.bodyKu = fields.titleKu ?? '';
    if (!image) return fields;

    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) form.append(key, value === null ? '' : String(value));
    }
    form.append('image', image, image.name);
    return form;
  }

  create(input: PrizeDrawInput): Promise<PrizeDraw> {
    return api.post<PrizeDraw>('/prize-draws', HttpPrizeDrawsRepository.body(input));
  }

  update(id: Id, input: Partial<PrizeDrawInput>): Promise<PrizeDraw> {
    return api.patch<PrizeDraw>(`/prize-draws/${id}`, HttpPrizeDrawsRepository.body(input));
  }

  async drawWinner(id: Id): Promise<PrizeDraw> {
    await api.post<PrizeDraw>(`/prize-draws/${id}/draw-winner`);
    return this.get(id);
  }
}

/** Draw entries. Listed only — the server issues them on renewal. */
class HttpCouponsRepository extends HttpCrudRepository<
  Coupon,
  never,
  never,
  { prizeDrawId?: Id; appUserId?: Id; status?: CouponStatus }
> {
  protected readonly serverSearch = true;

  constructor() {
    super('/coupons');
  }
}

export class HttpContentRepository implements ContentRepository {
  readonly ads: CrudRepository<Ad, AdInput, Partial<AdInput>, { type?: AdKind }> = new HttpAdsRepository();

  readonly faqs: CrudRepository<Faq, FaqInput> = new HttpCrudRepository<Faq, FaqInput>(
    '/faqs',
    (row) => `${row.question} ${row.questionKu} ${row.answer}`,
  );

  readonly videos: CrudRepository<TutorialVideo, VideoInput> = new HttpCrudRepository<
    TutorialVideo,
    VideoInput
  >('/tutorial-videos', (row) => `${row.title} ${row.titleKu} ${row.subtitle ?? ''}`);

  readonly towers: CrudRepository<
    Tower,
    TowerInput,
    Partial<TowerInput>,
    { silversatRegionId?: Id }
  > = new HttpCrudRepository<Tower, TowerInput, Partial<TowerInput>, { silversatRegionId?: Id }>(
    '/towers',
    (row) => `${row.name} ${row.nameKu} ${row.silversatRegion?.name ?? ''}`,
    );

  readonly contactLinks: CrudRepository<ContactLink, ContactLinkInput> = new HttpCrudRepository<
    ContactLink,
    ContactLinkInput
  >('/contact-links', (row) => `${row.label} ${row.labelKu} ${row.value} ${row.type}`);

  readonly prizeDraws: PrizeDrawsRepository = new HttpPrizeDrawsRepository();

  readonly coupons = new HttpCouponsRepository();
}
