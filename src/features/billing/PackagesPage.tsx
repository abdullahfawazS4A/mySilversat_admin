/**
 * Subscription packages — the price list the renew screen renders.
 *
 * Two product rules are enforced here rather than left to the operator:
 * exactly one package may be featured (the renew screen highlights one), and a
 * package that has ever been sold is deactivated rather than deleted so old
 * receipts still resolve.
 */

import { useState } from 'react';
import { Package, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Modal,
  Notice,
  Pill,
  Switch,
  TextInput,
} from '@/components/ui';
import type { SubscriptionPackage } from '@/types';
import { formatIqd, formatNumber } from '@/lib/format';

export function PackagesPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const [editing, setEditing] = useState<SubscriptionPackage | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SubscriptionPackage | null>(null);
  const [busy, setBusy] = useState(false);

  const packages = useAsync(() => repos.catalog.packages(), []);

  const runDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await repos.catalog.deletePackage(deleting.id);
      toast('انحذفت الباقة');
      setDeleting(null);
      packages.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الحذف', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="الباقات والأسعار"
        subtitle="مدد الاشتراك المعروضة في شاشة التجديد داخل التطبيق"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            إضافة باقة
          </Button>
        }
      />

      <div className="page">
        <AsyncBlock state={packages}>
          {(rows) => (
            <div className="grid grid-3">
              {rows.map((pkg) => (
                <Card key={pkg.id} pad className="col" style={{ gap: 'var(--sp-3)' }}>
                  <div className="row between">
                    <span className="chip-icon">
                      <Package size={17} />
                    </span>
                    <div className="row row-gap-1">
                      {pkg.featured ? (
                        <Pill tone="gold">
                          <Star size={11} />
                          مميزة
                        </Pill>
                      ) : null}
                      <Pill tone={pkg.active ? 'success' : 'muted'}>
                        {pkg.active ? 'مفعّلة' : 'معطّلة'}
                      </Pill>
                    </div>
                  </div>

                  <div className="col">
                    <span className="fs-20 strong num">{pkg.months} أشهر</span>
                    <span className="fs-17 strong num" style={{ color: 'var(--brand-primary)' }}>
                      {formatIqd(pkg.price)}
                    </span>
                  </div>

                  <div className="col fs-12 muted" style={{ gap: 3 }}>
                    <span>
                      سعر الشهر الواحد:{' '}
                      <span className="num">{formatNumber(Math.round(pkg.price / pkg.months))} د.ع</span>
                    </span>
                    {pkg.save > 0 ? (
                      <span style={{ color: 'var(--success)' }}>
                        توفير <span className="num">{formatNumber(pkg.save)}</span> د.ع
                      </span>
                    ) : null}
                    {pkg.bonus ? <span style={{ color: 'var(--gold)' }}>+ شهر مجاني إضافي</span> : null}
                  </div>

                  <div className="row row-gap-2">
                    <Button variant="outline" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(pkg)}>
                      تعديل
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={13} />}
                      title="حذف"
                      onClick={() => setDeleting(pkg)}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </AsyncBlock>

        <Notice tone="info">
          الباقة المميزة وحدة فقط — لمّا تميّز باقة جديدة، القديمة تنشال تلقائياً. أي باقة انباعت
          سابقاً ما تنحذف؛ عطّلها بدل الحذف حتى تبقى الفواتير القديمة مقروءة.
        </Notice>
      </div>

      {editing ? (
        <PackageDialog
          pkg={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            packages.reload();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="حذف الباقة"
          message={`راح تنحذف باقة ${deleting.months} أشهر نهائياً.`}
          confirmLabel="حذف"
          danger
          pending={busy}
          onConfirm={() => void runDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function PackageDialog({
  pkg,
  onClose,
  onSaved,
}: {
  pkg: SubscriptionPackage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [months, setMonths] = useState(String(pkg?.months ?? 3));
  const [price, setPrice] = useState(String(pkg?.price ?? 15000));
  const [save, setSave] = useState(String(pkg?.save ?? 0));
  const [bonus, setBonus] = useState(pkg?.bonus ?? false);
  const [featured, setFeatured] = useState(pkg?.featured ?? false);
  const [active, setActive] = useState(pkg?.active ?? true);

  const submit = async () => {
    if (Number(months) < 1 || Number(price) < 1) {
      toast('المدة والسعر لازم يكونون أكبر من صفر', 'error');
      return;
    }
    const ok = await run(() =>
      repos.catalog.savePackage({
        id: pkg?.id,
        months: Number(months),
        price: Number(price),
        save: Number(save),
        bonus,
        featured,
        active,
        sortOrder: pkg?.sortOrder ?? 0,
      }),
    );
    if (ok) {
      toast(pkg ? 'انحفظت الباقة' : 'انضافت الباقة');
      onSaved();
    }
  };

  return (
    <Modal
      title={pkg ? 'تعديل الباقة' : 'إضافة باقة'}
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
          <Field label="عدد الأشهر">
            <TextInput type="number" min={1} max={36} value={months} onChange={setMonths} />
          </Field>
          <Field label="السعر (د.ع)">
            <TextInput type="number" min={0} step={500} value={price} onChange={setPrice} />
          </Field>
        </div>

        <Field label="قيمة التوفير المعروضة (د.ع)" hint="اتركها صفر إذا ما بيها توفير">
          <TextInput type="number" min={0} step={500} value={save} onChange={setSave} />
        </Field>

        <Switch checked={bonus} onChange={setBonus} label="تمنح شهر مجاني إضافي عند التجديد" />
        <Switch checked={featured} onChange={setFeatured} label="اعرضها كباقة مميزة في التطبيق" />
        <Switch checked={active} onChange={setActive} label="مفعّلة ومعروضة للبيع" />
      </div>
    </Modal>
  );
}
