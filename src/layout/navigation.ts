/**
 * The navigation map.
 *
 * One place defines every route, its Arabic label and its icon. The sidebar,
 * the command palette and the router all read this, so a new screen is added
 * once rather than in three places.
 */

import {
  Banknote,
  BellRing,
  CalendarClock,
  ClipboardList,
  Gift,
  Image,
  LayoutDashboard,
  MapPin,
  Users,
  Trophy,
  Tv,
  Ticket,
  Settings,
  Boxes,
  Plug,
  Signal,
  Video,
  HelpCircle,
  Phone,
  Target,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Short description shown in the command palette. */
  hint: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'عام',
    items: [
      {
        path: '/',
        label: 'لوحة المعلومات',
        icon: LayoutDashboard,
        hint: 'المؤشرات الرئيسية والمبيعات والنشاط',
      },
    ],
  },
  {
    title: 'توقع واربح',
    items: [
      {
        path: '/matches',
        label: 'المباريات',
        icon: CalendarClock,
        hint: 'كل المباريات — واختيار أي مباراة يفتح عليها التوقع',
      },
      {
        path: '/predictions',
        label: 'التوقعات',
        icon: Target,
        hint: 'توقعات المشتركين واحتساب النقاط',
      },
      {
        path: '/leaderboard',
        label: 'الترتيب والنقاط',
        icon: Trophy,
        hint: 'ترتيب المتوقعين حسب النقاط',
      },
      {
        path: '/leagues',
        label: 'الدوريات والفرق',
        icon: ClipboardList,
        hint: 'الدوريات والفرق الواصلة من المزوّد',
      },
    ],
  },
  {
    title: 'المشتركون',
    items: [
      {
        path: '/users',
        label: 'المشتركون',
        icon: Users,
        hint: 'بحث بالاسم أو الهاتف، وفتح سجل المشترك',
      },
      {
        path: '/devices',
        label: 'الأجهزة',
        icon: Tv,
        hint: 'رسيفرات المشتركين، والاستعلام والشحن من السيرفر',
      },
      {
        path: '/sales',
        label: 'المبيعات',
        icon: Banknote,
        hint: 'الكارتات المباعة وقيمتها',
      },
      {
        path: '/stock',
        label: 'المخزن',
        icon: Boxes,
        hint: 'المنتجات وفئاتها ورفعات الكارتات — والربط بالمحافظة وسيرفر الـ API',
      },
    ],
  },
  {
    title: 'السحوبات',
    items: [
      {
        path: '/draws',
        label: 'السحوبات والجوائز',
        icon: Gift,
        hint: 'إعلان السحب ونصّه وموعده — إجراء السحب ماكو إله endpoint',
      },
      {
        path: '/coupons',
        label: 'الكوبونات',
        icon: Ticket,
        hint: 'غير مربوطة بالـ API — ماكو endpoint يعرض كوبونات المشتركين',
      },
    ],
  },
  {
    title: 'محتوى التطبيق',
    items: [
      {
        path: '/slides',
        label: 'سلايدر الرئيسية',
        icon: Image,
        hint: 'الإعلانات المتحركة في أعلى الشاشة الرئيسية',
      },
      {
        path: '/videos',
        label: 'الفيديوهات',
        icon: Video,
        hint: 'فيديوهات الشرح داخل التطبيق',
      },
      {
        path: '/faq',
        label: 'الأسئلة الشائعة',
        icon: HelpCircle,
        hint: 'الأسئلة والأجوبة بالعربي والكردي',
      },
      {
        path: '/towers',
        label: 'الأبراج',
        icon: Signal,
        hint: 'مواقع الأبراج وبيانات ضبط الصحن',
      },
      {
        path: '/contact',
        label: 'قنوات التواصل',
        icon: Phone,
        hint: 'أرقام وحسابات الدعم داخل التطبيق',
      },
    ],
  },
  {
    title: 'التواصل',
    items: [
      {
        path: '/notifications',
        label: 'الإشعارات',
        icon: BellRing,
        hint: 'الإشعارات المرسلة وإرسال إشعار جديد',
      },
    ],
  },
  {
    title: 'النظام',
    items: [
      {
        path: '/provinces',
        label: 'المحافظات والدول',
        icon: MapPin,
        hint: 'وحدة التقسيم اللي ينبني عليها كل شي',
      },
      {
        path: '/api',
        label: 'الـ API',
        icon: Plug,
        hint: 'سيرفرات سلفرسات ومزوّد المباريات',
      },
      {
        path: '/audit',
        label: 'سجل العمليات',
        icon: ClipboardList,
        hint: 'غير مربوطة بالـ API — ماكو سجل عمليات',
      },
      {
        path: '/settings',
        label: 'الإعدادات',
        icon: Settings,
        hint: 'حسابك وكلمة المرور',
      },
    ],
  },
];

/** Flat list, for the command palette and for title lookups. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Resolves the page title for a pathname, longest prefix wins. */
export function titleForPath(pathname: string): string {
  const exact = NAV_ITEMS.find((item) => item.path === pathname);
  if (exact) return exact.label;
  const prefix = NAV_ITEMS.filter((item) => item.path !== '/' && pathname.startsWith(item.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
  return prefix?.label ?? 'لوحة تحكم سلفرسات';
}
