/**
 * The audit log.
 *
 * Read-only by design: an operations log you can edit is not evidence. Every
 * mutation in the repository layer writes an entry here, so this screen is
 * where a dispute gets settled — who extended that subscription, who ran that
 * draw, who zeroed those points.
 *
 * Filters are the ones a dispute actually starts from: a person, a kind of
 * record, or a free-text detail from a customer's complaint.
 */

import { useMemo, useState } from 'react';
import { ClipboardList, Download } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useDebounced } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { DataTable, PageHeader, Toolbar, type Column } from '@/components/page';
import { AsyncBlock, Button, EmptyState, Pill, SearchInput, Select } from '@/components/ui';
import type { AuditEntry } from '@/types';
import { AUDIT_ACTION } from '@/lib/labels';
import { formatDateTimeAr, relativeAr } from '@/lib/format';
import { downloadCsv } from '@/lib/utils';

/** Entity keys the repositories write, with the Arabic word for each. */
const ENTITY_LABELS: Record<string, string> = {
  user: 'مشترك',
  device: 'جهاز',
  renewal: 'تجديد',
  package: 'باقة',
  match: 'مباراة',
  prediction: 'توقع',
  season: 'موسم',
  points: 'نقاط',
  draw: 'سحب',
  prize: 'جائزة',
  coupon: 'كوبون',
  offer: 'عرض',
  slide: 'سلايد',
  video: 'فيديو',
  faq: 'سؤال شائع',
  tower: 'برج',
  campaign: 'إشعار',
  agent: 'وكيل',
  admin: 'مستخدم إداري',
  league: 'دوري',
  team: 'فريق',
  governorate: 'محافظة',
  settings: 'إعدادات',
  session: 'جلسة',
  system: 'النظام',
};

const entityLabel = (key: string) => ENTITY_LABELS[key] ?? key;

export function AuditPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [entityType, setEntityType] = useState<string>('all');
  const [page, setPage] = useState(1);

  const entries = useAsync(
    () =>
      repos.admin.audit({
        search: debounced,
        entityType: entityType === 'all' ? undefined : entityType,
        page,
        pageSize: 30,
      }),
    [debounced, entityType, page],
  );

  // The entity filter offers only kinds that actually appear in the log.
  const entityOptions = useMemo(() => {
    const keys = new Set(Object.keys(ENTITY_LABELS));
    return ['all', ...[...keys].sort()];
  }, []);

  const exportCsv = async () => {
    const all = await repos.admin.audit({
      search: debounced,
      entityType: entityType === 'all' ? undefined : entityType,
      pageSize: 100000,
    });
    downloadCsv('audit.csv', [
      ['التاريخ', 'المستخدم', 'العملية', 'النوع', 'المعرّف', 'التفاصيل'],
      ...all.items.map((entry) => [
        formatDateTimeAr(entry.at),
        entry.adminName,
        AUDIT_ACTION[entry.action]?.label ?? entry.action,
        entityLabel(entry.entityType),
        entry.entityId,
        entry.summaryAr,
      ]),
    ]);
    toast('تم تصدير الملف');
  };

  const columns: Column<AuditEntry>[] = [
    {
      key: 'at',
      header: 'التاريخ',
      width: 190,
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35 }}>
          <span className="fs-12">{formatDateTimeAr(row.at)}</span>
          <span className="fs-11 dim">{relativeAr(row.at)}</span>
        </div>
      ),
    },
    {
      key: 'adminName',
      header: 'المستخدم',
      width: 150,
      render: (row) => <span className="fs-13">{row.adminName}</span>,
    },
    {
      key: 'action',
      header: 'العملية',
      width: 100,
      render: (row) => {
        const meta = AUDIT_ACTION[row.action];
        return <Pill tone={meta?.tone ?? 'neutral'}>{meta?.label ?? row.action}</Pill>;
      },
    },
    {
      key: 'entityType',
      header: 'النوع',
      width: 110,
      render: (row) => <span className="fs-12 muted">{entityLabel(row.entityType)}</span>,
    },
    {
      key: 'summaryAr',
      header: 'التفاصيل',
      render: (row) => (
        <div className="col" style={{ lineHeight: 1.35, minWidth: 0 }}>
          <span className="fs-13">{row.summaryAr}</span>
          <span className="fs-11 dim num">{row.entityId}</span>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="سجل العمليات"
        subtitle="كل تعديل صار باللوحة — مين سواه ومتى"
        actions={
          <Button variant="outline" icon={<Download size={15} />} onClick={() => void exportCsv()}>
            تصدير CSV
          </Button>
        }
      />

      <div className="page">
        <div className="card">
          <Toolbar>
            <SearchInput
              value={search}
              onChange={(next) => {
                setSearch(next);
                setPage(1);
              }}
              placeholder="بحث بالتفاصيل أو باسم المستخدم…"
            />
            <Select
              value={entityType}
              onChange={(next) => {
                setEntityType(next);
                setPage(1);
              }}
              options={entityOptions.map((key) => ({
                value: key,
                label: key === 'all' ? 'كل الأنواع' : entityLabel(key),
              }))}
            />
          </Toolbar>

          <AsyncBlock state={entries}>
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
                    title="ما بيها عمليات مطابقة"
                    hint="جرّب تغيّر الفلاتر أو وسّع البحث."
                    icon={<ClipboardList size={22} />}
                  />
                }
              />
            )}
          </AsyncBlock>
        </div>
      </div>
    </>
  );
}
