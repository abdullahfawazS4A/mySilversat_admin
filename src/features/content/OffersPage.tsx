/**
 * Offers shown in the app's offers screen.
 *
 * Two things the console adds over what the app renders: a schedule window, so
 * a campaign can be prepared in advance and expire on its own, and governorate
 * targeting, which is how the client runs "Nineveh only" discounts.
 */

import { useState } from 'react';
import { ArrowDown, ArrowUp, Gift, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Notice,
  Pill,
  Select,
  Switch,
  TextArea,
  TextInput,
} from '@/components/ui';
import type { GradientIndex, IconKey, Offer } from '@/types';
import { GRADIENT_SWATCHES, ICON_KEYS } from '@/lib/labels';
import { formatDateAr } from '@/lib/format';

/** True when the offer is live right now, ignoring the manual active switch. */
function inWindow(offer: Offer): boolean {
  const now = Date.now();
  return new Date(offer.startsAt).getTime() <= now && new Date(offer.endsAt).getTime() >= now;
}

export function OffersPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Offer | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);

  const offers = useAsync(() => repos.content.offers(), []);
  const governorates = useAsync(() => repos.catalog.governorates(), []);

  const move = async (offer: Offer, direction: -1 | 1) => {
    await repos.content.reorder('offer', offer.id, direction);
    offers.reload();
  };

  const runDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await repos.content.deleteOffer(deleting.id);
      toast('انحذف العرض');
      setDeleting(null);
      offers.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="العروض"
        subtitle="بطاقات شاشة العروض داخل التطبيق، مع جدولة زمنية واستهداف بالمحافظة"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            إضافة عرض
          </Button>
        }
      />

      <div className="page">
        <AsyncBlock
          state={offers}
          emptyWhen={(rows) => rows.length === 0}
          empty={<EmptyState title="ما بيها عروض" icon={<Gift size={22} />} />}
        >
          {(rows) => (
            <div className="grid grid-2">
              {rows.map((offer, index) => {
                const live = offer.active && inWindow(offer);
                return (
                  <Card key={offer.id} className="col">
                    <div
                      style={{
                        height: offer.tall ? 108 : 74,
                        background: GRADIENT_SWATCHES[offer.gradientIndex],
                        borderRadius: 'var(--r-card) var(--r-card) 0 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                      }}
                    >
                      {offer.artText ? (
                        <div className="col center">
                          <span className="fs-24 strong num">{offer.artText}</span>
                          {offer.artSubAr ? <span className="fs-12">{offer.artSubAr}</span> : null}
                        </div>
                      ) : (
                        <Gift size={26} />
                      )}
                    </div>

                    <div className="col card-pad" style={{ gap: 'var(--sp-3)' }}>
                      <div className="row between row-gap-2">
                        <Pill tone="neutral">{offer.badgeAr}</Pill>
                        <Pill tone={live ? 'success' : 'muted'}>{live ? 'ظاهر الآن' : 'ما يظهر'}</Pill>
                      </div>

                      <span className="fs-13 strong" style={{ lineHeight: 1.5 }}>
                        {offer.titleAr}
                      </span>

                      <div className="col fs-12 muted" style={{ gap: 2 }}>
                        <span>
                          من {formatDateAr(offer.startsAt)} إلى {formatDateAr(offer.endsAt)}
                        </span>
                        <span>
                          {offer.governorateScoped
                            ? `محافظات: ${offer.governorateIds
                                .map((id) => governorates.data?.find((g) => g.id === id)?.nameAr)
                                .filter(Boolean)
                                .join('، ')}`
                            : 'كل المحافظات'}
                        </span>
                      </div>

                      <div className="row row-gap-1">
                        <Button variant="outline" size="sm" icon={<Pencil size={13} />} onClick={() => setEditing(offer)}>
                          تعديل
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ArrowUp size={13} />}
                          title="تقديم"
                          disabled={index === 0}
                          onClick={() => void move(offer, -1)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ArrowDown size={13} />}
                          title="تأخير"
                          disabled={index === rows.length - 1}
                          onClick={() => void move(offer, 1)}
                        />
                        <span className="grow" />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeleting(offer)} />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </AsyncBlock>
      </div>

      {editing ? (
        <OfferDialog
          offer={editing === 'new' ? null : editing}
          governorates={(governorates.data ?? []).map((g) => ({ id: g.id, name: g.nameAr }))}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            offers.reload();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="حذف العرض"
          message={`راح ينحذف "${deleting.titleAr}" من شاشة العروض.`}
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

function OfferDialog({
  offer,
  governorates,
  onClose,
  onSaved,
}: {
  offer: Offer | null;
  governorates: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const today = new Date().toISOString().slice(0, 10);

  const [badgeAr, setBadgeAr] = useState(offer?.badgeAr ?? '');
  const [titleAr, setTitleAr] = useState(offer?.titleAr ?? '');
  const [artText, setArtText] = useState(offer?.artText ?? '');
  const [artSubAr, setArtSubAr] = useState(offer?.artSubAr ?? '');
  const [iconKey, setIconKey] = useState<IconKey | ''>(offer?.iconKey ?? '');
  const [gradientIndex, setGradientIndex] = useState<GradientIndex>(offer?.gradientIndex ?? 0);
  const [tall, setTall] = useState(offer?.tall ?? false);
  const [scoped, setScoped] = useState(offer?.governorateScoped ?? false);
  const [governorateIds, setGovernorateIds] = useState<string[]>(offer?.governorateIds ?? []);
  const [startsAt, setStartsAt] = useState((offer?.startsAt ?? new Date().toISOString()).slice(0, 10));
  const [endsAt, setEndsAt] = useState((offer?.endsAt ?? new Date().toISOString()).slice(0, 10));
  const [active, setActive] = useState(offer?.active ?? true);

  const submit = async () => {
    if (!titleAr.trim() || !badgeAr.trim()) {
      toast('الشارة والعنوان مطلوبين', 'error');
      return;
    }
    if (scoped && governorateIds.length === 0) {
      toast('اختر محافظة واحدة على الأقل', 'error');
      return;
    }
    const ok = await run(() =>
      repos.content.saveOffer({
        id: offer?.id,
        badgeAr: badgeAr.trim(),
        titleAr: titleAr.trim(),
        artText: artText.trim() || undefined,
        artSubAr: artSubAr.trim() || undefined,
        iconKey: iconKey || undefined,
        gradientIndex,
        tall,
        governorateScoped: scoped,
        governorateIds: scoped ? governorateIds : [],
        startsAt: new Date(startsAt || today).toISOString(),
        endsAt: new Date(`${endsAt || today}T23:59:59`).toISOString(),
        active,
        sortOrder: offer?.sortOrder ?? 0,
      }),
    );
    if (ok) {
      toast(offer ? 'انحفظ العرض' : 'انضاف العرض');
      onSaved();
    }
  };

  return (
    <Modal
      title={offer ? 'تعديل العرض' : 'إضافة عرض'}
      onClose={onClose}
      size="lg"
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

        <Field label="الشارة" hint="النص الصغير فوق العنوان">
          <TextInput value={badgeAr} onChange={setBadgeAr} placeholder="عرض تموز" />
        </Field>

        <Field label="عنوان العرض">
          <TextArea value={titleAr} onChange={setTitleAr} rows={2} placeholder="جدد سنة كاملة واحصل على شهر مجاني!" />
        </Field>

        <div className="grid grid-form">
          <Field label="النص الكبير على البطاقة" hint="مثل +1 أو 10%">
            <TextInput value={artText} onChange={setArtText} />
          </Field>
          <Field label="النص تحته">
            <TextInput value={artSubAr} onChange={setArtSubAr} placeholder="شهر مجاني" />
          </Field>
        </div>

        <Field label="أيقونة بديلة" hint="تُستخدم إذا ما بيها نص كبير">
          <Select
            value={iconKey}
            onChange={(next) => setIconKey(next as IconKey | '')}
            options={[{ value: '', label: 'بدون أيقونة' }, ...ICON_KEYS]}
          />
        </Field>

        <Field label="لون البطاقة">
          <div className="row row-gap-2 wrap">
            {GRADIENT_SWATCHES.map((swatch, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setGradientIndex(index as GradientIndex)}
                style={{
                  width: 48,
                  height: 32,
                  borderRadius: 'var(--r-chip)',
                  background: swatch,
                  border: gradientIndex === index ? '2px solid var(--brand-deep)' : '1px solid var(--hairline)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </Field>

        <Switch checked={tall} onChange={setTall} label="بطاقة بارتفاع مضاعف" />

        <div className="grid grid-form">
          <Field label="يبدأ في">
            <TextInput type="date" value={startsAt} onChange={setStartsAt} />
          </Field>
          <Field label="ينتهي في">
            <TextInput type="date" value={endsAt} onChange={setEndsAt} />
          </Field>
        </div>

        <div className="card card-pad col" style={{ gap: 'var(--sp-3)', background: 'var(--bg-app)' }}>
          <Switch checked={scoped} onChange={setScoped} label="اعرضه لمحافظات محددة فقط" />
          {scoped ? (
            <div className="row wrap row-gap-2">
              {governorates.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`chip${governorateIds.includes(g.id) ? ' active' : ''}`}
                  onClick={() =>
                    setGovernorateIds((current) =>
                      current.includes(g.id) ? current.filter((id) => id !== g.id) : [...current, g.id],
                    )
                  }
                >
                  {g.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Switch checked={active} onChange={setActive} label="العرض مفعّل" />
      </div>
    </Modal>
  );
}
