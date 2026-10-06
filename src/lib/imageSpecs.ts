/**
 * The sizes the app draws each uploaded picture at.
 *
 * Agreed with the Flutter app: every one of these is shown with
 * `BoxFit.cover` in a frame of exactly this ratio, so an upload at the right
 * ratio is never cropped and anything else loses its edges. The console frames
 * its previews the same way so the operator sees what the subscriber will.
 *
 * Text and logos belong inside the safe area — a rectangle inset 6% on every
 * edge — and only background art should reach the border. A ratio change on
 * the app side has to be mirrored here.
 */

import type { AdKind } from '@/types';

export interface ImageSpec {
  /** Width over height, e.g. 2.2 for 2.2:1. */
  ratio: number;
  /** The ratio as the operator reads it. */
  ratioLabel: string;
  /** The size to upload at. */
  width: number;
  height: number;
  /** Below this the app has to upscale. */
  minWidth: number;
  minHeight: number;
  /** Draws the 6% safe-area guide over the preview. */
  safeArea: boolean;
  /** Shown in a circle — a crest. Expects a transparent PNG. */
  round?: boolean;
}

/** The inset of the safe area on every edge, as a fraction of the side. */
export const SAFE_AREA_INSET = 0.06;

/** How far a picked image's ratio may drift before the picker warns. */
export const RATIO_TOLERANCE = 0.05;

/** Suggested ceiling on file weight, in bytes. The hard cap stays at 5 MB. */
export const SUGGESTED_BYTES = 300 * 1024;

export const IMAGE_SPECS = {
  /** Home carousel, full width, nothing drawn over it. */
  ad: { ratio: 2.2, ratioLabel: '2.2:1', width: 1320, height: 600, minWidth: 880, minHeight: 400, safeArea: true },
  /** Offers screen, one full-width card each. */
  offer: { ratio: 4 / 3, ratioLabel: '4:3', width: 1200, height: 900, minWidth: 800, minHeight: 600, safeArea: true },
  /** The card on the draws screen. */
  draw: { ratio: 16 / 9, ratioLabel: '16:9', width: 1280, height: 720, minWidth: 960, minHeight: 540, safeArea: true },
  /** A small circle next to the club's name. */
  teamLogo: {
    ratio: 1,
    ratioLabel: '1:1',
    width: 512,
    height: 512,
    minWidth: 256,
    minHeight: 256,
    safeArea: false,
    round: true,
  },
} satisfies Record<string, ImageSpec>;

/** A banner's frame follows its type: the carousel and the offers screen differ. */
export function adImageSpec(kind: AdKind | undefined): ImageSpec {
  return kind === 'offers' ? IMAGE_SPECS.offer : IMAGE_SPECS.ad;
}
