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
 */

import { useState } from 'react';
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
  Select,
  SearchInput,
} from '@/components/ui';
import { formatDateAr, formatPhone } from '@/lib/format';
import type { Device, Id, SilversatRegion } from '@/types';
import { VendorPayload } from '../shared/VendorPayload';
import { RenewDialog } from './RenewDialog';

export function DevicesPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [provinceId, setProvinceId] = useState<Id | 'all'>('all');
  const [page, setPage] = useState(1);

  const provinces = useAsync(() => repos.geo.provinces.all(), []);
  const regions = useAsync(() => repos.silversat.regions(), []);

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

  // The vendor needs a region on every call, and a device does not carry one,
  // so the operator picks it once for the screen rather than per action.
  const [regionId, setRegionId] = useState<Id>('');
  const activeRegion = regionId || regions.data?.[0]?.id || '';

  const sendSignal = async () => {
    if (!signalling) return;
    const ok = await run(() => repos.silversat.sendSignal(activeRegion, signalling.deviceNumber));
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
          <span className="fs-13 strong">{row.name}</span>
          <span className="fs-11 dim num">{row.deviceNumber}</span>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'المشترك',
      render: (row) =>
        row.appUser ? (
          <Link className="col" to={`/users/${row.appUserId}`} style={{ lineHeight: 1.35 }}>
            <span className="fs-13">{row.appUser.name}</span>
            <span className="fs-11 dim num">{formatPhone(row.appUser.phone)}</span>
          </Link>
        ) : (
          <span className="dim">—</span>
        ),
    },
    {
      key: 'province',
      header: 'المحافظة',
      render: (row) => row.appUser?.province?.name ?? '—',
    },
    {
      key: 'added',
      header: 'تاريخ الإضافة',
      render: (row) => <span className="fs-12">{formatDateAr(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 140,
      render: (row) => (
        <div className="row row-gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon={<Search size={14} />}
            title="استعلام عن الاشتراك"
            onClick={() => setInspecting(row)}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<RadioTower size={14} />}
            title="إرسال إشارة"
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
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="الأجهزة"
        subtitle="رسيفرات المشتركين — والاستعلام والشحن يروحون مباشرة لسيرفر سلفرسات"
      />

      <div className="page">
        <Notice tone="warning">
          الاستعلام وإرسال الإشارة والشحن كلها إجراءات مباشرة على سيرفر سلفرسات — ما ننحفظ عدنا أي
          سجل إلها. اختر السيرفر الصحيح قبل ما تنفّذ.
        </Notice>

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
            <Select<Id>
              value={activeRegion}
              onChange={setRegionId}
              options={(regions.data ?? []).map((row: SilversatRegion) => ({
                value: row.id,
                label: `سيرفر: ${row.name}`,
              }))}
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
          regionId={activeRegion}
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
              <span className="strong num">{signalling.deviceNumber}</span> حتى يحدّث اشتراكه.
              الإجراء يروح مباشرة للسيرفر.
              {action.error ? <div className="field-error mt-2">{action.error}</div> : null}
            </>
          }
          onConfirm={() => void sendSignal()}
          onCancel={() => setSignalling(null)}
        />
      ) : null}

      {recharging ? (
        <RenewDialog device={recharging} onClose={() => setRecharging(null)} />
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
 */
function SubscriptionDialog({
  device,
  regionId,
  onClose,
}: {
  device: Device;
  regionId: Id;
  onClose: () => void;
}) {
  const repos = useRepos();
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
      <AsyncBlock state={state}>{(data) => <VendorPayload data={data} />}</AsyncBlock>
    </Modal>
  );
}
