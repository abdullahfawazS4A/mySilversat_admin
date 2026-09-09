/**
 * Governorates.
 *
 * The list is fixed — Iraq's governorates are not something an operator adds
 * or deletes — so this screen only toggles service coverage and edits the two
 * name fields. Turning one off is a real product decision: offers, towers and
 * agents scoped to it stop showing in the app, which is why the switch states
 * its consequence instead of just flipping.
 */

import { useState } from 'react';
import { MapPin, Pencil, Users } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader } from '@/components/page';
import {
  AsyncBlock,
  Button,
  ConfirmDialog,
  Field,
  Modal,
  Notice,
  Pill,
  SearchInput,
  Switch,
  TextInput,
} from '@/components/ui';
import { BarList, StatTile } from '@/components/charts';
import type { Governorate } from '@/types';
import { formatNumber, formatPercent } from '@/lib/format';
import { matchesSearch } from '@/lib/utils';

export function GovernoratesPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Governorate | null>(null);
  const [disabling, setDisabling] = useState<Governorate | null>(null);
  const [run, action] = useAction();

  const governorates = useAsync(() => repos.catalog.governorates(), []);

  const rows = (governorates.data ?? []).filter(
    (g) => matchesSearch(g.nameAr, search) || matchesSearch(g.nameCkb, search),
  );
  const activeCount = (governorates.data ?? []).filter((g) => g.active).length;
  const subscribers = (governorates.data ?? []).reduce((sum, g) => sum + g.subscriberCount, 0);

  const setActive = async (governorate: Governorate, active: boolean) => {
    const ok = await run(() => repos.catalog.saveGovernorate({ ...governorate, active }));
    if (ok) {
      toast(active ? `انفعّلت ${governorate.nameAr}` : `انعطّلت ${governorate.nameAr}`);
      setDisabling(null);
      governorates.reload();
    }
  };

  return (
    <>
      <PageHeader title="المحافظات" subtitle="تغطية الخدمة وتوزيع المشتركين" />

      <div className="page col" style={{ gap: 'var(--sp-4)' }}>
        <div className="grid grid-kpi-3">
          <StatTile
            label="محافظات مفعّلة"
            value={`${formatNumber(activeCount)} / ${formatNumber(governorates.data?.length ?? 0)}`}
            icon={<MapPin size={15} />}
          />
          <StatTile
            label="مجموع المشتركين"
            value={formatNumber(subscribers)}
            icon={<Users size={15} />}
          />
          <StatTile
            label="أكبر محافظة"
            value={governorates.data?.[0]?.nameAr ?? '—'}
            hint={
              governorates.data?.[0]
                ? `${formatPercent(governorates.data[0].subscriberCount / (subscribers || 1), 1)} من المشتركين`
                : undefined
            }
          />
        </div>

        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <div className="split">
          <div className="card">
            <div className="card-head">
              <div className="col">
                <h3>التغطية</h3>
                <span className="fs-12 muted">إطفاء محافظة يخفيها من التطبيق كلياً</span>
              </div>
            </div>

            <div className="card-pad col" style={{ gap: 'var(--sp-4)' }}>
              <SearchInput value={search} onChange={setSearch} placeholder="بحث باسم المحافظة…" />

              <AsyncBlock state={governorates}>
                {() => (
                  <div className="col" style={{ gap: 'var(--sp-2)' }}>
                    {rows.map((governorate) => (
                      <div
                        key={governorate.id}
                        className="row row-gap-3 card card-pad"
                        style={{ alignItems: 'center' }}
                      >
                        <span className="chip-icon" style={{ width: 30, height: 30 }}>
                          <MapPin size={15} />
                        </span>
                        <div className="col grow" style={{ lineHeight: 1.35, minWidth: 0 }}>
                          <span className="fs-13 strong truncate">{governorate.nameAr}</span>
                          <span className="fs-11 dim truncate">{governorate.nameCkb}</span>
                        </div>

                        <Pill tone={governorate.subscriberCount > 0 ? 'neutral' : 'muted'}>
                          <span className="num">{formatNumber(governorate.subscriberCount)}</span> مشترك
                        </Pill>

                        <Switch
                          checked={governorate.active}
                          onChange={(next) =>
                            next ? void setActive(governorate, true) : setDisabling(governorate)
                          }
                          title={governorate.active ? 'مفعّلة' : 'معطّلة'}
                        />

                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil size={13} />}
                          title="تعديل الاسم"
                          onClick={() => setEditing(governorate)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </AsyncBlock>
            </div>
          </div>

          <div className="card card-pad col" style={{ gap: 'var(--sp-4)' }}>
            <div className="col">
              <h3>توزيع المشتركين</h3>
              <span className="fs-12 muted">أكبر عشر محافظات</span>
            </div>
            <BarList
              points={(governorates.data ?? []).map((g) => ({
                label: g.nameAr,
                value: g.subscriberCount,
              }))}
              limit={10}
            />
          </div>
        </div>
      </div>

      {editing ? (
        <GovernorateDialog
          governorate={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            governorates.reload();
          }}
        />
      ) : null}

      {disabling ? (
        <ConfirmDialog
          title={`تعطيل ${disabling.nameAr}`}
          message={
            <>
              العروض والأبراج والوكلاء المرتبطين بهذه المحافظة راح يختفون من التطبيق، و
              <span className="num strong"> {formatNumber(disabling.subscriberCount)} </span>
              مشترك بيها راح ما يشوفون محتوى مخصص لمنطقتهم. اشتراكاتهم الحالية ما تتأثر.
            </>
          }
          confirmLabel="تعطيل"
          danger
          pending={action.pending}
          onConfirm={() => void setActive(disabling, false)}
          onCancel={() => setDisabling(null)}
        />
      ) : null}
    </>
  );
}

function GovernorateDialog({
  governorate,
  onClose,
  onSaved,
}: {
  governorate: Governorate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [nameAr, setNameAr] = useState(governorate.nameAr);
  const [nameCkb, setNameCkb] = useState(governorate.nameCkb);

  const submit = async () => {
    if (!nameAr.trim()) {
      toast('الاسم بالعربي مطلوب', 'error');
      return;
    }
    const ok = await run(() =>
      repos.catalog.saveGovernorate({
        ...governorate,
        nameAr: nameAr.trim(),
        nameCkb: nameCkb.trim(),
      }),
    );
    if (ok) {
      toast('انحفظت المحافظة');
      onSaved();
    }
  };

  return (
    <Modal
      title="تعديل المحافظة"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={() => void submit()} disabled={action.pending}>
            حفظ
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}
        <Field label="الاسم بالعربي">
          <TextInput value={nameAr} onChange={setNameAr} />
        </Field>
        <Field label="الاسم بالكردي">
          <TextInput value={nameCkb} onChange={setNameCkb} />
        </Field>
      </div>
    </Modal>
  );
}
