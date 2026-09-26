/**
 * Receivers.
 *
 * Our database knows very little about a receiver — a label, a number and who
 * owns it. Everything an operator is actually asked on the phone ("is he
 * subscribed?", "until when?") lives in the vendor's system, so the useful
 * actions on this screen are the three that reach out to it: read the
 * subscription, re-send the authorisation signal, and recharge with a code.
 *
 * Those are live actions on real hardware with no local record, which is why
 * they are per-row rather than bulk, and why the two that change something
 * confirm first.
 *
 * **The server is the owner's, not chosen.** Every subscriber registers on
 * one SilverSat server, and the API validated this receiver against that
 * server when it was added — so the screen asks that same server per row
 * instead of applying one dropdown to every device in the table. A query is
 * only meaningful against the server the subscriber is on: the same receiver
 * number asked of another server answers, and answers wrongly, which is the
 * failure a support tool can least afford. The override is still there for the
 * case the owner cannot be read, and it says what it is overriding.
 */

import { useMemo, useState } from 'react';
import { RadioTower, Search, Tv, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, PageHeader, Toolbar, type Column } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Modal,
  Notice,
  Pill,
  Select,
  SearchInput,
} from '@/components/ui';
import { formatDateAr, formatPhone } from '@/lib/format';
import type { Device, Id, SilversatRegion } from '@/types';
import { VendorPayload } from '../shared/VendorPayload';
import { RenewDialog } from './RenewDialog';

/** Which server a device's vendor calls go to, and how that was decided. */
interface Routing {
  region: SilversatRegion | null;
  /** `derived` is the owner's own server; `manual` came from the override. */
  source: 'derived' | 'manual' | 'none';
  /** Why a derivation failed, ready to render. */
  problem?: string;
}

export function DevicesPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [provinceId, setProvinceId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);

  const provinces = useAsync(() => repos.geo.provinces.all(), []);
  const regions = useAsync(() => repos.silversat.regions(), []);

  const regionById = useMemo(
    () => new Map((regions.data ?? []).map((row) => [row.id, row])),
    [regions.data],
  );

  const devices = useAsync(
    () =>
      repos.devices.list({
        search: debounced,
        provinceId: provinceId === 'all' ? undefined : provinceId,
        page,
        pageSize: 25,
      }),
    [debounced, provinceId, page],
  );

  const [inspecting, setInspecting] = useState<Device | null>(null);
  const [signalling, setSignalling] = useState<Device | null>(null);
  const [recharging, setRecharging] = useState<Device | null>(null);
  const [run, action] = useAction();

  /**
   * The override, used only where the chain cannot answer.
   *
   * Empty means "use the owner's province", which is the right default — a
   * sticky manual choice is exactly how the wrong server gets asked about the
   * right receiver on the next call.
   */
  const [overrideRegion, setOverrideRegion] = useState<Id | ''>('');

  const routeFor = (device: Device): Routing => {
    if (overrideRegion) {
      const region = (regions.data ?? []).find((row) => row.id === overrideRegion) ?? null;
      return { region, source: 'manual' };
    }

    const owner = device.appUser;
    if (!owner?.silversatRegionId) {
      return { region: null, source: 'none', problem: 'الجهاز ما إله مشترك أو سيرفر' };
    }

    // The active list is preferred for being the vendor-facing record; a
    // stopped server is missing from it, so the embedded copy still names it.
    const region = regionById.get(owner.silversatRegionId) ?? owner.silversatRegion ?? null;
    if (!region) {
      return { region: null, source: 'none', problem: 'سيرفر المشترك ما ينلكى' };
    }
    if (!region.isActive) {
      return { region, source: 'derived', problem: 'سيرفر المشترك متوقف' };
    }
    return { region, source: 'derived' };
  };

  const sendSignal = async () => {
    if (!signalling) return;
    const route = routeFor(signalling);
    if (!route.region) return;
    const ok = await run(() =>
      repos.silversat.sendSignal(route.region!.id, signalling.deviceNumber),
    );
    if (!ok) return;
    toast('انرسلت الإشارة للجهاز');
    setSignalling(null);
  };

  const columns: Column<Device>[] = [
    {
      key: 'device',
      header: 'الجهاز',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-body strong">{row.name}</span>
          <span className="fs-tiny dim num">{row.deviceNumber}</span>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'المشترك',
      render: (row) =>
        row.appUser ? (
          <Link className="col" to={`/users/${row.appUserId}`} style={{ lineHeight: 1.35 }}>
            <span className="fs-body">{row.appUser.name}</span>
            <span className="fs-tiny dim num">{formatPhone(row.appUser.phone)}</span>
          </Link>
        ) : (
          <span className="dim">—</span>
        ),
    },
    {
      key: 'province',
      header: 'المحافظة',
      render: (row) => row.appUser?.silversatRegion?.province?.name ?? '—',
    },
    {
      key: 'server',
      header: 'السيرفر',
      render: (row) => {
        const route = routeFor(row);
        if (!route.region) {
          return (
            <span title={route.problem}>
              <Pill tone="danger">{route.problem ?? 'غير محدّد'}</Pill>
            </span>
          );
        }
        return (
          <div className="col" style={{ lineHeight: 1.35 }}>
            <span className="fs-small">{route.region.name}</span>
            <span className="fs-tiny dim">
              {route.source === 'manual' ? 'اختيار يدوي' : 'سيرفر المشترك'}
            </span>
          </div>
        );
      },
    },
    {
      key: 'added',
      header: 'تاريخ الإضافة',
      render: (row) => <span className="fs-small">{formatDateAr(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 140,
      render: (row) => {
        const route = routeFor(row);
        return (
          <div className="row row-gap-1">
            <Button
              variant="ghost"
              size="sm"
              icon={<Search size={14} />}
              title={route.region ? 'استعلام عن الاشتراك' : route.problem}
              disabled={!route.region}
              onClick={() => setInspecting(row)}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<RadioTower size={14} />}
              title={route.region ? 'إرسال إشارة' : route.problem}
              disabled={!route.region}
              onClick={() => setSignalling(row)}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Zap size={14} />}
              title="شحن أو تجديد"
              onClick={() => setRecharging(row)}
            />
          </div>
        );
      },
    },
  ];

  const unroutable = (devices.data?.items ?? []).filter((row) => !routeFor(row).region).length;

  return (
    <>
      <PageHeader
        title="الأجهزة"
        subtitle="رسيفرات المشتركين — والاستعلام والشحن يروحون لسيرفر المشترك"
      />

      <div className="page">
        <Notice tone="warning">
          الاستعلام وإرسال الإشارة والشحن كلها إجراءات مباشرة على سيرفر سلفرسات — ما ننحفظ عدنا أي
          سجل إلها. السيرفر هو سيرفر المشترك نفسه، فما تحتاج تنتخبه.
        </Notice>

        {unroutable > 0 ? (
          <Notice tone="danger">
            <span className="strong num">{unroutable}</span> جهاز بهذي الصفحة ما ينلكى إله سيرفر —
            صاحبه ما إله سيرفر مقروء. صلّح سيرفر المشترك من صفحته، أو انتخب سيرفر يدوياً من فوق.
          </Notice>
        ) : null}

        <Card>
          <Toolbar>
            <SearchInput
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(1);
              }}
              placeholder="ابحث برقم الجهاز أو الاسم…"
            />
            <Select
              value={provinceId}
              onChange={(next) => {
                setProvinceId(next);
                setPage(1);
              }}
              options={[
                { value: 'all' as const, label: 'كل المحافظات' },
                ...(provinces.data ?? []).map((row) => ({ value: row.id, label: row.name })),
              ]}
            />
            <Select<Id | ''>
              value={overrideRegion}
              onChange={setOverrideRegion}
              options={[
                { value: '', label: 'السيرفر: سيرفر المشترك' },
                ...(regions.data ?? []).map((row: SilversatRegion) => ({
                  value: row.id,
                  label: `تجاوز: ${row.name}`,
                })),
              ]}
            />
          </Toolbar>

          <AsyncBlock state={devices}>
            {(data) => (
              <DataTable
                columns={columns}
                rows={data.items}
                rowKey={(row) => row.id}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
                empty={
                  <EmptyState
                    icon={<Tv size={20} />}
                    title="ماكو أجهزة"
                    hint="ما ينربط أي رسيفر بهذه الفلاتر"
                  />
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {inspecting ? (
        <SubscriptionDialog
          device={inspecting}
          routing={routeFor(inspecting)}
          onClose={() => setInspecting(null)}
        />
      ) : null}

      {signalling ? (
        <ConfirmDialog
          title="إرسال إشارة للجهاز"
          confirmLabel="إرسال"
          pending={action.pending}
          message={
            <>
              راح تنرسل إشارة تفويض للجهاز{' '}
              <span className="strong num">{signalling.deviceNumber}</span> حتى يحدّث اشتراكه، على
              سيرفر <span className="strong">{routeFor(signalling).region?.name ?? '—'}</span>.
              الإجراء يروح مباشرة للسيرفر.
              {action.error ? <div className="field-error mt-2">{action.error}</div> : null}
            </>
          }
          onConfirm={() => void sendSignal()}
          onCancel={() => setSignalling(null)}
        />
      ) : null}

      {recharging ? (
        <RenewDialog
          device={recharging}
          region={routeFor(recharging).region}
          onClose={() => setRecharging(null)}
        />
      ) : null}
    </>
  );
}

/**
 * Reads the subscription straight from the vendor.
 *
 * The answer's shape belongs to the vendor, not to us, so it is rendered as
 * received rather than mapped onto fields we have invented — a made-up label
 * over a field that turns out to mean something else is worse than raw keys.
 * Which server answered is stated above it, because the same receiver number
 * means different things on different servers.
 */
function SubscriptionDialog({
  device,
  routing,
  onClose,
}: {
  device: Device;
  routing: Routing;
  onClose: () => void;
}) {
  const repos = useRepos();
  const regionId = routing.region?.id ?? '';
  const state = useAsync(
    () => repos.silversat.subscription(regionId, device.deviceNumber),
    [regionId, device.id],
  );

  return (
    <Modal
      title={`اشتراك الجهاز ${device.deviceNumber}`}
      size="lg"
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          إغلاق
        </Button>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-3)' }}>
        <Notice tone={routing.problem ? 'warning' : 'info'}>
          الاستعلام راح لسيرفر <span className="strong">{routing.region?.name ?? '—'}</span>
          {routing.source === 'manual' ? ' (اختيار يدوي)' : ' — سيرفر المشترك'}.
          {routing.problem ? ` ${routing.problem}.` : ''}
        </Notice>
        <AsyncBlock state={state}>{(data) => <VendorPayload data={data} />}</AsyncBlock>
      </div>
    </Modal>
  );
}
