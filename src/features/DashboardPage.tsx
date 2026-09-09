/**
 * Dashboard.
 *
 * Answers, in order: is money coming in, are subscriptions healthy, is the
 * prediction game running, and what changed today. Anything that needs a
 * decision links straight to the screen that makes it.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  BellRing,
  Boxes,
  CalendarClock,
  CircleDot,
  Radio,
  Target,
  Ticket,
  Tv,
  UserPlus,
  Users,
} from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync } from '@/app/useAsync';
import { PageHeader } from '@/components/page';
import { AsyncBlock, Button, Card, CardHead, Pill, Skeleton } from '@/components/ui';
import { BarList, SplitBar, StatTile, TrendChart } from '@/components/charts';
import { deltaPercent, formatIqd, formatIqdCompact, formatNumber, relativeAr } from '@/lib/format';
import { AUDIT_ACTION } from '@/lib/labels';

type TrendMode = 'revenue' | 'renewals';

export function DashboardPage() {
  const repos = useRepos();
  const summary = useAsync(() => repos.admin.dashboard(), []);
  const audit = useAsync(() => repos.admin.audit({ pageSize: 8 }), []);
  const levels = useAsync(() => repos.stock.levels(), []);
  const governorates = useAsync(() => repos.catalog.governorates(), []);
  const [trendMode, setTrendMode] = useState<TrendMode>('revenue');

  // Governorates that can still sell but have run out of at least one card
  // length. Named rather than counted, because the first question is "which".
  const soldOut = [
    ...new Set(
      (levels.data ?? [])
        .filter((level) => level.available === 0)
        .map((level) => governorates.data?.find((g) => g.id === level.governorateId))
        .filter((governorate) => governorate?.active)
        .map((governorate) => governorate!.nameAr),
    ),
  ];

  return (
    <>
      <PageHeader
        title="لوحة المعلومات"
        subtitle="نظرة عامة على الاشتراكات والإيرادات ومسابقة توقع واربح"
      />

      <div className="page">
        <AsyncBlock
          state={summary}
          skeleton={
            <div className="grid grid-kpi">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} pad>
                  <Skeleton h={12} w="60%" />
                  <div className="mt-3">
                    <Skeleton h={22} w="45%" />
                  </div>
                </Card>
              ))}
            </div>
          }
        >
          {(data) => (
            <>
              {/* Anything needing action today comes before the numbers. */}
              {data.expiringDevices > 0 || data.liveMatches > 0 || soldOut.length > 0 ? (
                <div className="row wrap row-gap-3">
                  {/*
                    Stock leads the strip when a governorate has run dry: an
                    expiring device is a lost opportunity, but an empty stock
                    means renewals are failing at the counter right now.
                  */}
                  {soldOut.length > 0 ? (
                    <Card pad className="row row-gap-3 grow">
                      <span className="chip-icon chip-danger">
                        <Boxes size={17} />
                      </span>
                      <div className="col grow">
                        <span className="fs-13 strong">
                          خلصت كارتات <span className="num">{soldOut.length}</span> محافظة
                        </span>
                        <span className="fs-12 muted truncate">
                          {soldOut.slice(0, 3).join('، ')}
                          {soldOut.length > 3 ? ` و${soldOut.length - 3} غيرها` : ''} — التجديد بيها
                          ينرفض
                        </span>
                      </div>
                      <Link to="/stock">
                        <Button variant="subtle" size="sm" icon={<Boxes size={14} />}>
                          عبّي المخزن
                        </Button>
                      </Link>
                    </Card>
                  ) : null}

                  {data.expiringDevices > 0 ? (
                    <Card pad className="row row-gap-3 grow">
                      <span className="chip-icon chip-warning">
                        <AlertTriangle size={17} />
                      </span>
                      <div className="col grow">
                        <span className="fs-13 strong">
                          <span className="num">{data.expiringDevices}</span> جهاز اشتراكه قرب ينتهي
                        </span>
                        <span className="fs-12 muted">أرسل تذكير أو جدّد لهم قبل الانتهاء</span>
                      </div>
                      <Link to="/notifications">
                        <Button variant="subtle" size="sm" icon={<BellRing size={14} />}>
                          إشعار تذكير
                        </Button>
                      </Link>
                    </Card>
                  ) : null}

                  {data.liveMatches > 0 ? (
                    <Card pad className="row row-gap-3 grow">
                      <span className="chip-icon" style={{ background: 'var(--live-tint)', color: 'var(--live)' }}>
                        <Radio size={17} />
                      </span>
                      <div className="col grow">
                        <span className="fs-13 strong">
                          <span className="num">{data.liveMatches}</span> مباراة تجري الآن
                        </span>
                        <span className="fs-12 muted">حدّث النتيجة المباشرة من شاشة المباريات</span>
                      </div>
                      <Link to="/matches">
                        <Button variant="subtle" size="sm">
                          فتح المباريات
                        </Button>
                      </Link>
                    </Card>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-kpi">
                <StatTile
                  label="إيرادات هذا الشهر"
                  value={formatIqdCompact(data.revenueThisMonth)}
                  hint={`الشهر الماضي ${formatIqdCompact(data.revenueLastMonth)}`}
                  icon={<Banknote size={15} />}
                  delta={deltaPercent(data.revenueThisMonth, data.revenueLastMonth)}
                />
                <StatTile
                  label="تجديدات هذا الشهر"
                  value={formatNumber(data.renewalsThisMonth)}
                  hint="معاملة مكتملة"
                  icon={<CalendarClock size={15} />}
                />
                <StatTile
                  label="إجمالي المشتركين"
                  value={formatNumber(data.totalUsers)}
                  hint={`${formatNumber(data.activeUsers)} فعّال · ${formatNumber(data.blockedUsers)} محظور`}
                  icon={<Users size={15} />}
                />
                <StatTile
                  label="مشتركون جدد هذا الشهر"
                  value={formatNumber(data.newUsersThisMonth)}
                  icon={<UserPlus size={15} />}
                />
                <StatTile
                  label="أجهزة فعّالة"
                  value={formatNumber(data.activeDevices)}
                  hint={`من أصل ${formatNumber(data.totalDevices)} جهاز`}
                  icon={<Tv size={15} />}
                  tone="success"
                />
                <StatTile
                  label="قرب تنتهي"
                  value={formatNumber(data.expiringDevices)}
                  hint="خلال أيام الإنذار المحددة بالإعدادات"
                  icon={<AlertTriangle size={15} />}
                  tone="warning"
                />
                <StatTile
                  label="اشتراكات منتهية"
                  value={formatNumber(data.expiredDevices)}
                  hint="فرصة لحملة استرجاع"
                  icon={<CircleDot size={15} />}
                  tone="danger"
                />
                <StatTile
                  label="كوبونات سارية"
                  value={formatNumber(data.couponsIssued)}
                  hint={`${data.pendingDraws} سحب قيد الانتظار`}
                  icon={<Ticket size={15} />}
                  tone="gold"
                />
              </div>

              <div className="split">
                <Card>
                  <CardHead
                    title={trendMode === 'revenue' ? 'الإيرادات آخر 12 شهر' : 'عدد التجديدات آخر 12 شهر'}
                    subtitle="مؤشر واحد في كل مرة — مقياسان مختلفان ما ينعرضون على محور واحد"
                    actions={
                      <div className="tabs">
                        <button
                          className={`tab${trendMode === 'revenue' ? ' active' : ''}`}
                          onClick={() => setTrendMode('revenue')}
                        >
                          إيرادات
                        </button>
                        <button
                          className={`tab${trendMode === 'renewals' ? ' active' : ''}`}
                          onClick={() => setTrendMode('renewals')}
                        >
                          تجديدات
                        </button>
                      </div>
                    }
                  />
                  <div style={{ padding: 'var(--sp-4)' }}>
                    <TrendChart
                      points={trendMode === 'revenue' ? data.revenueTrend : data.renewalTrend}
                      format={(v) => (trendMode === 'revenue' ? formatIqd(v) : `${formatNumber(v)} تجديد`)}
                    />
                  </div>
                </Card>

                <Card>
                  <CardHead title="مسابقة توقع واربح" subtitle="حالة المسابقة الآن" />
                  <div className="col card-pad" style={{ gap: 'var(--sp-4)' }}>
                    <div className="row between">
                      <span className="row row-gap-2 fs-13">
                        <Target size={15} style={{ color: 'var(--brand-primary)' }} />
                        مباريات مفتوحة للتوقع
                      </span>
                      <span className="fs-17 strong num">{data.openPredictionMatches}</span>
                    </div>
                    <div className="row between">
                      <span className="row row-gap-2 fs-13">
                        <Radio size={15} style={{ color: 'var(--live)' }} />
                        مباريات مباشرة
                      </span>
                      <span className="fs-17 strong num">{data.liveMatches}</span>
                    </div>
                    <div className="row between">
                      <span className="row row-gap-2 fs-13">
                        <CalendarClock size={15} style={{ color: 'var(--brand-primary)' }} />
                        توقعات هذا الأسبوع
                      </span>
                      <span className="fs-17 strong num">{formatNumber(data.predictionsThisWeek)}</span>
                    </div>
                    <Link to="/matches">
                      <Button variant="primary" className="grow">
                        اختيار المباريات المفتوحة
                      </Button>
                    </Link>
                  </div>
                </Card>
              </div>

              <div className="grid grid-2">
                <Card>
                  <CardHead title="المشتركون حسب المحافظة" subtitle="أعلى 8 محافظات" />
                  <div className="card-pad">
                    <BarList
                      points={data.usersByGovernorate.map((row) => ({ label: row.label, value: row.value }))}
                      limit={8}
                    />
                  </div>
                </Card>

                <div className="col" style={{ gap: 'var(--sp-4)' }}>
                  <Card>
                    <CardHead title="التجديدات حسب طريقة الدفع" />
                    <div className="card-pad">
                      <SplitBar points={data.renewalsByMethod} />
                    </div>
                  </Card>
                  <Card>
                    <CardHead title="التجديدات حسب الباقة" />
                    <div className="card-pad">
                      <SplitBar points={data.renewalsByPackage} />
                    </div>
                  </Card>
                </div>
              </div>
            </>
          )}
        </AsyncBlock>

        <Card>
          <CardHead
            title="آخر العمليات"
            subtitle="من غيّر ماذا ومتى"
            actions={
              <Link to="/audit">
                <Button variant="ghost" size="sm">
                  السجل الكامل
                </Button>
              </Link>
            }
          />
          <AsyncBlock state={audit}>
            {(page) => (
              <div className="col">
                {page.items.map((entry) => {
                  const action = AUDIT_ACTION[entry.action] ?? { label: entry.action, tone: 'neutral' as const };
                  return (
                    <div
                      key={entry.id}
                      className="row row-gap-3"
                      style={{ padding: '11px var(--sp-5)', borderBottom: '1px solid var(--divider)' }}
                    >
                      <Pill tone={action.tone}>{action.label}</Pill>
                      <span className="fs-13 grow truncate">{entry.summaryAr}</span>
                      <span className="fs-12 dim">{entry.adminName}</span>
                      <span className="fs-12 dim">{relativeAr(entry.at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </AsyncBlock>
        </Card>
      </div>
    </>
  );
}
