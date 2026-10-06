/**
 * The screens a banner or a push can open, keyed as the app routes them.
 *
 * This is the app's own list (`AppRoutes.deepLinkable` in the Flutter app),
 * not a suggestion: the app ignores any other value and the tap does nothing,
 * so the target is picked from here rather than typed. The labels are the
 * titles the subscriber sees on each screen. A screen added to the app has to
 * be added here too.
 *
 * A banner sends the key as its `actionValue`; a notification sends it as
 * `data.route`. Both are read against this same list.
 */
export const APP_SCREENS: { value: string; label: string }[] = [
  { value: 'home', label: 'الرئيسية' },
  { value: 'renew', label: 'تجديد الاشتراك' },
  { value: 'offers', label: 'العروض' },
  { value: 'matches', label: 'المباريات' },
  { value: 'predict', label: 'توقع واربح' },
  { value: 'draws', label: 'جدد واربح' },
  { value: 'account', label: 'حسابي' },
  { value: 'tower', label: 'اتجاه البرج' },
  { value: 'videos', label: 'مقاطع فيديو تعليمية' },
  { value: 'faq', label: 'الأسئلة الشائعة' },
  { value: 'notifications', label: 'الإشعارات' },
];

/** The Arabic name of a screen target, or null when the app has no such screen. */
export function screenName(value: string | null | undefined): string | null {
  const key = (value ?? '').trim().toLowerCase().split('/').find(Boolean) ?? '';
  return APP_SCREENS.find((screen) => screen.value === key)?.label ?? null;
}
