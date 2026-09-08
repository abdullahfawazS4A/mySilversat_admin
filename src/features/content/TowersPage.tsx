/**
 * Transmitter towers.
 *
 * The app's compass screen points a customer's dish at the nearest tower, so
 * two fields here are load-bearing rather than descriptive: the coordinates
 * (the compass bearing is computed from them) and the frequency / polarization
 * / symbol rate triple that support reads out over the phone. A wrong digit in
 * either sends an installer to the wrong sky, which is why the dialog keeps
 * them together in one block with the alignment values spelled out.
 *
 * Grouping is by governorate because that is how coverage is discussed.
 */

import { useMemo, useState } from 'react';
import { MapPin, Pencil, Plus, Signal, Trash2 } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader } from '@/components/page';
import {
  AsyncBlock,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  KeyValue,
  Modal,
  Notice,
  Pill,
  SearchInput,
  Select,
  Switch,
  TextInput,
} from '@/components/ui';
import type { Governorate, Id, Tower } from '@/types';
import { formatNumber } from '@/lib/format';
import { matchesSearch } from '@/lib/utils';

export function TowersPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Tower | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Tower | null>(null);
  const [run, action] = useAction();

  const towers = useAsync(() => repos.content.towers(), []);
  const governorates = useAsync(() => repos.catalog.governorates(), []);

  const governorateName = (id: Id) =>
    governorates.data?.find((g) => g.id === id)?.nameAr ?? '—';

  // Grouped by governorate, each group sorted with the primary tower first.
  const groups = useMemo(() => {
    const rows = (towers.data ?? []).filter(
      (tower) => matchesSearch(tower.nameAr, search) || matchesSearch(governorateName(tower.governorateId), search),
    );
    const map = new Map<Id, Tower[]>();
    for (const tower of rows) {
      const bucket = map.get(tower.governorateId);
      if (bucket) bucket.push(tower);
      else map.set(tower.governorateId, [tower]);
    }
    return [...map.entries()].map(([governorateId, list]) => ({
      governorateId,
      towers: [...list].sort((a, b) => Number(b.strong) - Number(a.strong)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [towers.data, governorates.data, search]);

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await run(() => repos.content.deleteTower(deleting.id));
    if (ok) {
      toast('انحذف البرج');
      setDeleting(null);
      towers.reload();
    }
  };

  const toggleActive = async (tower: Tower, active: boolean) => {
    await run(() => repos.content.saveTower({ ...tower, active }));
    towers.reload();
  };

  return (
    <>
      <PageHeader
        title="الأبراج"
        subtitle="مواقع الإرسال وبيانات ضبط الصحن اللي يقرأها التطبيق"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            إضافة برج
          </Button>
        }
      />

      <div className="page">
        <div className="col" style={{ gap: 'var(--sp-4)' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="بحث باسم البرج أو المحافظة…" />

          {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

          <AsyncBlock
            state={towers}
            emptyWhen={() => groups.length === 0}
            empty={<EmptyState title="ما بيها أبراج" icon={<Signal size={22} />} />}
          >
            {() =>
              groups.map((group) => (
                <div key={group.governorateId} className="col" style={{ gap: 'var(--sp-3)' }}>
                  <div className="row row-gap-2">
                    <MapPin size={15} />
                    <span className="fs-13 strong">{governorateName(group.governorateId)}</span>
                    <span className="fs-12 dim num">{formatNumber(group.towers.length)}</span>
                  </div>

                  <div className="grid grid-2">
                    {group.towers.map((tower) => (
                      <div key={tower.id} className="card card-pad col" style={{ gap: 'var(--sp-3)' }}>
                        <div className="row between row-gap-2">
                          <div className="row row-gap-2" style={{ minWidth: 0 }}>
                            <span className="chip-icon" style={{ width: 30, height: 30 }}>
                              <Signal size={15} />
                            </span>
                            <span className="fs-13 strong truncate">{tower.nameAr}</span>
                          </div>
                          <div className="row row-gap-1">
                            {tower.strong ? <Pill tone="success">البرج الرئيسي</Pill> : null}
                            <Pill tone={tower.active ? 'neutral' : 'muted'}>
                              {tower.active ? 'يعمل' : 'متوقف'}
                            </Pill>
                          </div>
                        </div>

                        <KeyValue
                          rows={[
                            ['التردد', <span className="num">{tower.frequency}</span>],
                            [
                              'الاستقطاب',
                              <span>{tower.polarization === 'H' ? 'أفقي (H)' : 'عمودي (V)'}</span>,
                            ],
                            ['معدل الترميز', <span className="num">{tower.symbolRate}</span>],
                            [
                              'الإحداثيات',
                              <span className="num" dir="ltr">
                                {tower.latitude.toFixed(4)}, {tower.longitude.toFixed(4)}
                              </span>,
                            ],
                          ]}
                        />

                        <div className="row row-gap-2">
                          <Switch
                            checked={tower.active}
                            onChange={(next) => void toggleActive(tower, next)}
                            label="يعمل"
                          />
                          <span className="grow" />
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<Pencil size={13} />}
                            onClick={() => setEditing(tower)}
                          >
                            تعديل
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 size={13} />}
                            title="حذف"
                            onClick={() => setDeleting(tower)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            }
          </AsyncBlock>
        </div>
      </div>

      {editing ? (
        <TowerDialog
          tower={editing === 'new' ? null : editing}
          governorates={governorates.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            towers.reload();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="حذف البرج"
          message={`راح ينحذف "${deleting.nameAr}" ومَعه بيانات الضبط الخاصة بيه.`}
          confirmLabel="حذف"
          danger
          pending={action.pending}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function TowerDialog({
  tower,
  governorates,
  onClose,
  onSaved,
}: {
  tower: Tower | null;
  governorates: Governorate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [nameAr, setNameAr] = useState(tower?.nameAr ?? '');
  const [governorateId, setGovernorateId] = useState<Id>(
    tower?.governorateId ?? governorates[0]?.id ?? '',
  );
  const [latitude, setLatitude] = useState(String(tower?.latitude ?? ''));
  const [longitude, setLongitude] = useState(String(tower?.longitude ?? ''));
  const [frequency, setFrequency] = useState(tower?.frequency ?? '');
  const [polarization, setPolarization] = useState<'H' | 'V'>(tower?.polarization ?? 'H');
  const [symbolRate, setSymbolRate] = useState(tower?.symbolRate ?? '');
  const [strong, setStrong] = useState(tower?.strong ?? false);
  const [active, setActive] = useState(tower?.active ?? true);

  const submit = async () => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!nameAr.trim() || !governorateId) {
      toast('اسم البرج والمحافظة مطلوبين', 'error');
      return;
    }
    // The compass reads these directly, so a typo has to be caught here.
    if (!Number.isFinite(lat) || lat < 28 || lat > 38) {
      toast('خط العرض لازم يكون بين 28 و 38', 'error');
      return;
    }
    if (!Number.isFinite(lng) || lng < 38 || lng > 49) {
      toast('خط الطول لازم يكون بين 38 و 49', 'error');
      return;
    }

    const ok = await run(() =>
      repos.content.saveTower({
        id: tower?.id,
        nameAr: nameAr.trim(),
        governorateId,
        latitude: lat,
        longitude: lng,
        strong,
        active,
        frequency: frequency.trim(),
        polarization,
        symbolRate: symbolRate.trim(),
      }),
    );
    if (ok) {
      toast(tower ? 'انحفظ البرج' : 'انضاف البرج');
      onSaved();
    }
  };

  return (
    <Modal
      size="lg"
      title={tower ? 'تعديل البرج' : 'إضافة برج'}
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

        <div className="grid grid-form">
          <Field label="اسم البرج">
            <TextInput value={nameAr} onChange={setNameAr} placeholder="برج بغداد المركزي" />
          </Field>
          <Field label="المحافظة">
            <Select
              value={governorateId}
              onChange={setGovernorateId}
              options={governorates.map((g) => ({ value: g.id, label: g.nameAr }))}
            />
          </Field>
        </div>

        <div className="grid grid-form">
          <Field label="خط العرض" hint="داخل العراق: 28 – 38">
            <TextInput type="number" step={0.0001} value={latitude} onChange={setLatitude} />
          </Field>
          <Field label="خط الطول" hint="داخل العراق: 38 – 49">
            <TextInput type="number" step={0.0001} value={longitude} onChange={setLongitude} />
          </Field>
        </div>

        <Notice tone="info">
          هذي القيم يقرأها الدعم للزبون وقت ضبط الصحن — تأكد منها قبل الحفظ.
        </Notice>

        <div className="grid grid-form">
          <Field label="التردد">
            <TextInput value={frequency} onChange={setFrequency} placeholder="11054 H" />
          </Field>
          <Field label="الاستقطاب">
            <Select
              value={polarization}
              onChange={setPolarization}
              options={[
                { value: 'H', label: 'أفقي (H)' },
                { value: 'V', label: 'عمودي (V)' },
              ]}
            />
          </Field>
        </div>

        <Field label="معدل الترميز">
          <TextInput value={symbolRate} onChange={setSymbolRate} placeholder="27500" />
        </Field>

        <div className="row row-gap-4 wrap">
          <Switch
            checked={strong}
            onChange={setStrong}
            label="البرج الرئيسي للمنطقة"
            title="التطبيق يعلّم هذا البرج كأقوى إشارة"
          />
          <Switch checked={active} onChange={setActive} label="يعمل" />
        </div>
      </div>
    </Modal>
  );
}
