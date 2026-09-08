/** Mock in-app content: offers, home slides, towers, videos and FAQ. */

import type { FaqItem, Id, Offer, Slide, Tower, VideoItem } from '@/types';
import type { ContentRepository } from '../types';
import { mockDb } from '@/data/mockDb';
import { removeById, requireById, upsert } from './helpers';

export class MockContentRepository implements ContentRepository {
  offers(): Promise<Offer[]> {
    return mockDb.read(() => [...mockDb.tables.offers].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async saveOffer(offer: Omit<Offer, 'id'> & { id?: Id }): Promise<Offer> {
    await mockDb.latency();
    const saved = upsert(mockDb.tables.offers, offer, 'ofr', {
      ...offer,
      sortOrder: mockDb.tables.offers.length,
    } as Omit<Offer, 'id'>);
    mockDb.audit(offer.id ? 'update' : 'create', 'offer', saved.id, `عرض: ${saved.titleAr}`);
    return saved;
  }

  async deleteOffer(id: Id): Promise<void> {
    await mockDb.latency();
    const offer = requireById(mockDb.tables.offers, id, 'العرض');
    removeById(mockDb.tables.offers, id);
    mockDb.audit('delete', 'offer', id, `حذف عرض: ${offer.titleAr}`);
  }

  slides(): Promise<Slide[]> {
    return mockDb.read(() => [...mockDb.tables.slides].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async saveSlide(slide: Omit<Slide, 'id'> & { id?: Id }): Promise<Slide> {
    await mockDb.latency();
    const saved = upsert(mockDb.tables.slides, slide, 'sld', {
      ...slide,
      sortOrder: mockDb.tables.slides.length,
    } as Omit<Slide, 'id'>);
    mockDb.audit(slide.id ? 'update' : 'create', 'slide', saved.id, `سلايد: ${saved.titleAr}`);
    return saved;
  }

  async deleteSlide(id: Id): Promise<void> {
    await mockDb.latency();
    const slide = requireById(mockDb.tables.slides, id, 'السلايد');
    removeById(mockDb.tables.slides, id);
    mockDb.audit('delete', 'slide', id, `حذف سلايد: ${slide.titleAr}`);
  }

  towers(): Promise<Tower[]> {
    return mockDb.read(() => [...mockDb.tables.towers]);
  }

  async saveTower(tower: Omit<Tower, 'id'> & { id?: Id }): Promise<Tower> {
    await mockDb.latency();
    const saved = upsert(mockDb.tables.towers, tower, 'twr', { ...tower } as Omit<Tower, 'id'>);
    mockDb.audit(tower.id ? 'update' : 'create', 'tower', saved.id, `برج: ${saved.nameAr}`);
    return saved;
  }

  async deleteTower(id: Id): Promise<void> {
    await mockDb.latency();
    const tower = requireById(mockDb.tables.towers, id, 'البرج');
    removeById(mockDb.tables.towers, id);
    mockDb.audit('delete', 'tower', id, `حذف برج: ${tower.nameAr}`);
  }

  videos(): Promise<VideoItem[]> {
    return mockDb.read(() => [...mockDb.tables.videos].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async saveVideo(video: Omit<VideoItem, 'id'> & { id?: Id }): Promise<VideoItem> {
    await mockDb.latency();
    const saved = upsert(mockDb.tables.videos, video, 'vid', {
      ...video,
      sortOrder: mockDb.tables.videos.length,
    } as Omit<VideoItem, 'id'>);
    mockDb.audit(video.id ? 'update' : 'create', 'video', saved.id, `فيديو: ${saved.titleAr}`);
    return saved;
  }

  async deleteVideo(id: Id): Promise<void> {
    await mockDb.latency();
    const video = requireById(mockDb.tables.videos, id, 'الفيديو');
    removeById(mockDb.tables.videos, id);
    mockDb.audit('delete', 'video', id, `حذف فيديو: ${video.titleAr}`);
  }

  faq(): Promise<FaqItem[]> {
    return mockDb.read(() => [...mockDb.tables.faq].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  async saveFaq(item: Omit<FaqItem, 'id'> & { id?: Id }): Promise<FaqItem> {
    await mockDb.latency();
    const saved = upsert(mockDb.tables.faq, item, 'faq', {
      ...item,
      sortOrder: mockDb.tables.faq.length,
    } as Omit<FaqItem, 'id'>);
    mockDb.audit(item.id ? 'update' : 'create', 'faq', saved.id, `سؤال: ${saved.questionAr}`);
    return saved;
  }

  async deleteFaq(id: Id): Promise<void> {
    await mockDb.latency();
    const item = requireById(mockDb.tables.faq, id, 'السؤال');
    removeById(mockDb.tables.faq, id);
    mockDb.audit('delete', 'faq', id, `حذف سؤال: ${item.questionAr}`);
  }

  async reorder(kind: 'offer' | 'slide' | 'video' | 'faq', id: Id, direction: -1 | 1): Promise<void> {
    await mockDb.latency();
    const table: { id: string; sortOrder: number }[] =
      kind === 'offer'
        ? mockDb.tables.offers
        : kind === 'slide'
          ? mockDb.tables.slides
          : kind === 'video'
            ? mockDb.tables.videos
            : mockDb.tables.faq;

    const sorted = [...table].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = sorted.findIndex((row) => row.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;

    // Swap the two sort keys, then renumber so the sequence stays dense.
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    sorted.forEach((row, i) => {
      row.sortOrder = i;
    });
    mockDb.audit('update', kind, id, 'تغيير ترتيب العنصر');
  }
}
