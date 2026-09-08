/**
 * The navigation map.
 *
 * One place defines every route, its Arabic label, its icon and the permission
 * that reveals it. The sidebar, the command palette and the router all read
 * this, so a new screen is added once rather than in three places.
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
  ShieldCheck,
  Store,
  Signal,
  Video,
  HelpCircle,
  Package,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { Permission } from '@/types';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Hidden when the signed-in role lacks this permission. */
  permission: Permission;
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
        permission: 'dashboard.view',
        hint: 'المؤشرات الرئيسية والإيرادات والنشاط',
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
        permission: 'matches.view',
        hint: 'كل المباريات — واختيار أي مباراة يفتح عليها التوقع',
      },
      {
        path: '/predictions',
        label: 'التوقعات',
        icon: Target,
        permission: 'predictions.view',
        hint: 'توقعات المشتركين واحتساب النقاط',
      },
      {
        path: '/leaderboard',
        label: 'الترتيب والنقاط',
        icon: Trophy,
        permission: 'predictions.view',
        hint: 'ترتيب المتوقعين، المواسم وتصفير النقاط',
      },
      {
        path: '/leagues',
        label: 'الدوريات والفرق',
        icon: ClipboardList,
        permission: 'matches.edit',
        hint: 'إدارة الدوريات والفرق المتاحة',
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
        permission: 'users.view',
        hint: 'بحث بالاسم أو الهاتف أو رقم الجهاز',
      },
      {
        path: '/devices',
        label: 'الأجهزة',
        icon: Tv,
        permission: 'devices.view',
        hint: 'كل الأجهزة، حالتها وتواريخ انتهائها',
      },
      {
        path: '/renewals',
        label: 'التجديدات',
        icon: Banknote,
        permission: 'renewals.view',
        hint: 'سجل المعاملات والإيرادات',
      },
      {
        path: '/packages',
        label: 'الباقات والأسعار',
        icon: Package,
        permission: 'packages.edit',
        hint: 'مدد الاشتراك وأسعارها',
      },
      {
        path: '/agents',
        label: 'الوكلاء',
        icon: Store,
        permission: 'agents.edit',
        hint: 'وكلاء البيع، أرصدتهم وعمولاتهم',
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
        permission: 'draws.view',
        hint: 'تعريف الجوائز، إجراء السحب ونشر الفائزين',
      },
      {
        path: '/coupons',
        label: 'الكوبونات',
        icon: Ticket,
        permission: 'draws.view',
        hint: 'كوبونات السحب الصادرة عن التجديدات',
      },
    ],
  },
  {
    title: 'محتوى التطبيق',
    items: [
      {
        path: '/offers',
        label: 'العروض',
        icon: Gift,
        permission: 'content.edit',
        hint: 'عروض شاشة العروض واستهداف المحافظات',
      },
      {
        path: '/slides',
        label: 'سلايدر الرئيسية',
        icon: Image,
        permission: 'content.edit',
        hint: 'الإعلانات المتحركة في أعلى الشاشة الرئيسية',
      },
      {
        path: '/videos',
        label: 'الفيديوهات',
        icon: Video,
        permission: 'content.edit',
        hint: 'فيديوهات الشرح داخل التطبيق',
      },
      {
        path: '/faq',
        label: 'الأسئلة الشائعة',
        icon: HelpCircle,
        permission: 'content.edit',
        hint: 'الأسئلة والأجوبة بالعربي والكردي',
      },
      {
        path: '/towers',
        label: 'الأبراج',
        icon: Signal,
        permission: 'content.edit',
        hint: 'مواقع الأبراج وبيانات ضبط الصحن',
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
        permission: 'notifications.send',
        hint: 'حملات الإشعارات واستهداف الجمهور',
      },
    ],
  },
  {
    title: 'النظام',
    items: [
      {
        path: '/governorates',
        label: 'المحافظات',
        icon: MapPin,
        permission: 'settings.edit',
        hint: 'تفعيل وتعطيل المحافظات',
      },
      {
        path: '/admins',
        label: 'المستخدمون الإداريون',
        icon: ShieldCheck,
        permission: 'admins.edit',
        hint: 'حسابات اللوحة والصلاحيات',
      },
      {
        path: '/audit',
        label: 'سجل العمليات',
        icon: ClipboardList,
        permission: 'audit.view',
        hint: 'من غيّر ماذا ومتى',
      },
      {
        path: '/settings',
        label: 'الإعدادات',
        icon: Settings,
        permission: 'settings.edit',
        hint: 'قواعد النقاط، الصيانة وبيانات الدعم',
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
