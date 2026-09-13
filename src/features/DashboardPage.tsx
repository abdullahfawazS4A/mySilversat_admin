/**
 * The dashboard.
 *
 * One `summary()` call backs the whole screen. There is no summary endpoint on
 * the API, so the repository composes it out of list routes — which means this
 * screen should ask for it once and never fan out reads of its own.
 *
 * The one figure worth reading carefully is revenue: it is sold codes valued at
 * their category's current list price, not money collected, because the API has
 * no ledger. The tile says so rather than implying a number it cannot support.
 */

import { useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  Radio,
  ServerCog,
  Target,
  Tv,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync } from '@/app/useAsync';
import { PageHeader } from '@/components/page';
import { AsyncBlock, Card, CardHead, EmptyState, Notice, Pill, Tabs } from '@/components/ui';
import { BarList, SplitBar, StatTile, TrendChart } from '@/components/charts';
import { formatIqd, formatIqdCompact, formatNumber } from '@/lib/format';
import type { DashboardSummary } from '@/types';

export function DashboardPage() {
  const repos = useRepos();
  const summary = useAsync(() => repos.dashboard.summary(), []);

  return (
    <>
      <PageHeader
        title="لوحة المعلومات"
        subtitle="صورة سريعة عن المشتركين والمخزن والمبيعات والتوقعات"
      />

      <div className="page">
        <AsyncBlock state={summary}>{(data) => <Summary data={data} />}</AsyncBlock>
      </div>
    </>
  );
}

function Summary({ data }: { data: DashboardSummary }) {
  const [trend, setTrend] = useState<'sales' | 'revenue'>('sales');

  const regionsDown = data.totalRegions - data.activeRegions;
  const lowStock = data.stockByCategory.filter(
    (row) => row.threshold !== null && row.value <= row.threshold,
  );

  return (
    <>
      {regionsDown > 0 ? (
        <Notice tone="warning">
          <span className="strong num">{regionsDown}</span> من{' '}
          <span className="num">{data.totalRegions}</span> سيرفر سلفرسات متوقف — تفعيل الكارتات
          للمنتجات المربوطة بيه ما راح يشتغل. <Link to="/api">افحص السيرفرات</Link>.
        </Notice>
      ) : null}

      {lowStock.length > 0 ? (
        <Notice tone="danger" icon={<AlertTriangle size={16} />}>
          <span className="strong num">{lowStock.length}</span> فئة وصلت حد التنبيه بالمخزن:{' '}
          {lowStock
            .slice(0, 3)
            .map((row) => row.label)
            .join('، ')}
          {lowStock.length > 3 ? ' وغيرها' : ''}. <Link to="/stock">افتح المخزن</Link>.
        </Notice>
      ) : null}

      {/* الصف الأول: الحجم — كم مشترك وكم جهاز وكم كارت متاح وكم مبيعات الشهر */}
      <div className="grid grid-kpi">
        <StatTile
          label="المشتركون"
          value={formatNumber(data.totalUsers)}
          icon={<Users size={15} />}
          hint={`${formatNumber(data.newUsersThisMonth)} جديد هذا الشهر`}
        />
        <StatTile
          label="الأجهزة"
          value={formatNumber(data.totalDevices)}
          icon={<Tv size={15} />}
          hint={`${formatNumber(data.blockedUsers)} مشترك محظور`}
        />
        <StatTile
          label="كارتات متاحة"
          value={formatNumber(data.codesAvailable)}
          icon={<Boxes size={15} />}
          tone={lowStock.length > 0 ? 'warning' : undefined}
          hint={`${formatNumber(data.codesSold)} مباع`}
        />
        <StatTile
          label="مبيعات هذا الشهر"
          value={formatNumber(data.soldThisMonth)}
          icon={<CircleDollarSign size={15} />}
          hint={formatIqd(data.revenueThisMonth)}
        />
      </div>

      {/* الصف الثاني: النشاط — المباشر والتوقعات والإشعارات والسيرفرات */}
      <div className="grid grid-kpi">
        <StatTile
          label="مباريات مباشرة"
          value={formatNumber(data.liveMatches)}
          icon={<Radio size={15} />}
          hint={`${formatNumber(data.openForPrediction)} مفتوحة للتوقع`}
        />
        <StatTile
          label="التوقعات"
          value={formatNumber(data.totalPredictions)}
          icon={<Target size={15} />}
          tone={data.pendingScoring > 0 ? 'warning' : undefined}
          hint={`${formatNumber(data.pendingScoring)} تنتظر الاحتساب`}
        />
        <StatTile
          label="سيرفرات فعّالة"
          value={`${formatNumber(data.activeRegions)} / ${formatNumber(data.totalRegions)}`}
          icon={<ServerCog size={15} />}
          tone={regionsDown > 0 ? 'danger' : 'success'}
        />
        <StatTile
          label="إشعارات مرسلة"
          value={formatNumber(data.notificationsSent)}
          hint={`${formatNumber(data.totalProducts)} منتج و${formatNumber(data.totalCategories)} فئة`}
        />
      </div>

      <div className="split">
        <Card pad>
          <CardHead
            title="الاتجاه الشهري"
            subtitle="الكارتات المباعة وقيمتها بسعر الفئة"
            actions={
              <Tabs
                value={trend}
                onChange={setTrend}
                items={[
                  { value: 'sales', label: 'عدد المبيعات' },
                  { value: 'revenue', label: 'القيمة' },
                ]}
              />
            }
          />
          <div className="mt-4">
            {(trend === 'sales' ? data.salesTrend : data.revenueTrend).length > 0 ? (
              <TrendChart
                points={trend === 'sales' ? data.salesTrend : data.revenueTrend}
                format={trend === 'revenue' ? formatIqdCompact : formatNumber}
              />
            ) : (
              <EmptyState title="ماكو بيانات كافية" hint="ما انباعت كارتات بالأشهر الماضية" />
            )}
          </div>
        </Card>

        <Card pad>
          <CardHead title="حالة الكارتات" subtitle="توزيع كل الكارتات بالمخزن" />
          <div className="mt-4">
            <SplitBar
              points={[
                { label: 'متاح', value: data.codesAvailable },
                { label: 'مباع', value: data.codesSold },
                { label: 'معطّل', value: data.codesDisabled },
              ]}
            />
          </div>

          <div className="mt-5">
            <span className="fs-12 muted">إجمالي المبيعات منذ البداية</span>
            <div className="fs-20 strong num">{formatIqd(data.revenueAllTime)}</div>
            <span className="fs-11 dim">
              محسوبة بسعر الفئة الحالي — مو مبالغ محصّلة فعلاً
            </span>
          </div>
        </Card>
      </div>

      <div className="grid grid-3">
        <Card pad>
          <CardHead title="المشتركون حسب المحافظة" />
          <div className="mt-4">
            {data.usersByProvince.length > 0 ? (
              <BarList points={data.usersByProvince} limit={7} />
            ) : (
              <EmptyState title="ماكو مشتركون" />
            )}
          </div>
        </Card>

        <Card pad>
          <CardHead title="المبيعات حسب الفئة" />
          <div className="mt-4">
            {data.salesByCategory.length > 0 ? (
              <BarList points={data.salesByCategory} limit={7} />
            ) : (
              <EmptyState title="ماكو مبيعات" />
            )}
          </div>
        </Card>

        <Card pad>
          <CardHead title="طابور إعادة التجهيز" subtitle="أقل الفئات مخزوناً" />
          <div className="mt-4 col row-gap-3">
            {data.stockByCategory.length === 0 ? (
              <EmptyState title="ماكو فئات" />
            ) : (
              data.stockByCategory.slice(0, 7).map((row) => (
                <div key={row.label} className="row between row-gap-3">
                  <span className="fs-12 truncate">{row.label}</span>
                  <span className="row row-gap-2">
                    <span className="num strong">{formatNumber(row.value)}</span>
                    {row.threshold !== null && row.value <= row.threshold ? (
                      <Pill tone="danger">تحت الحد</Pill>
                    ) : null}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
