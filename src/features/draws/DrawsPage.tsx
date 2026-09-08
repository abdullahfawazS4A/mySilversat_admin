/**
 * Prize draws.
 *
 * The lifecycle is deliberately one-way: draft -> open -> drawn -> published.
 * Running a draw is irreversible by design; a mistake is corrected by creating
 * a new draw, so both attempts stay visible in the audit log. Re-rolling a
 * prize draw quietly is the fastest way to lose a promotion's credibility.
 */

import { useState } from 'react';
import {
  Award,
  Dices,
  Gift,
  Megaphone,
  Package,
  Pencil,
  Plus,
  Ticket,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { useAuth } from '@/app/AuthContext';
import { PageHeader } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  CardHead,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  Notice,
  Pill,
  Select,
  Switch,
  TextInput,
} from '@/components/ui';
import { StatTile } from '@/components/charts';
import type { Draw, GradientIndex, IconKey, Prize } from '@/types';
import { DRAW_STATE, GRADIENT_SWATCHES, ICON_KEYS } from '@/lib/labels';
import { formatDateAr, formatNumber } from '@/lib/format';

export function DrawsPage() {
  const repos = useRepos();
  const { toast } = useToast();
  const { can } = useAuth();
  const canRun = can('draws.run');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingDraw, setEditingDraw] = useState<Draw | 'new' | null>(null);
  const [editingPrize, setEditingPrize] = useState<Prize | 'new' | null>(null);
  const [confirmRun, setConfirmRun] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [deletingPrize, setDeletingPrize] = useState<Prize | null>(null);
  const [busy, setBusy] = useState(false);

  const draws = useAsync(() => repos.draws.draws(), []);
  const current = draws.data?.find((d) => d.id === selectedId) ?? draws.data?.[0];

  const prizes = useAsync(
    () => (current ? repos.draws.prizes(current.id) : Promise.resolve([])),
    [current?.id],
  );
  const winners = useAsync(
    () => (current ? repos.draws.winners(current.id) : Promise.resolve([])),
    [current?.id],
  );

  const totalWinners = (prizes.data ?? []).reduce((sum, p) => sum + p.winnersCount, 0);

  const runDraw = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const created = await repos.draws.runDraw(current.id);
      toast(`تم السحب — ${created.length} فائز`);
      setConfirmRun(false);
      draws.reload();
      winners.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر إجراء السحب', 'error');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!current) return;
    setBusy(true);
    try {
      await repos.draws.publishDraw(current.id);
      toast('انتشرت النتائج داخل التطبيق');
      setConfirmPublish(false);
      draws.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر النشر', 'error');
    } finally {
      setBusy(false);
    }
  };

  const removePrize = async () => {
    if (!deletingPrize) return;
    setBusy(true);
    try {
      await repos.draws.deletePrize(deletingPrize.id);
      toast('انحذفت الجائزة');
      setDeletingPrize(null);
      prizes.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر الحذف', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleClaimed = async (winnerId: string, claimed: boolean) => {
    await repos.draws.setWinnerClaimed(winnerId, claimed);
    winners.reload();
  };

  return (
    <>
      <PageHeader
        title="السحوبات والجوائز"
        subtitle="تعريف الجوائز، إجراء السحب على الكوبونات المؤهلة، ونشر أسماء الفائزين"
        actions={
          canRun ? (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditingDraw('new')}>
              سحب جديد
            </Button>
          ) : null
        }
      />

      <div className="page">
        <AsyncBlock state={draws} emptyWhen={(rows) => rows.length === 0}>
          {(rows) => {
            const draw = current!;
            const state = DRAW_STATE[draw.state];
            return (
              <>
                <div className="chips">
                  {rows.map((item) => (
                    <button
                      key={item.id}
                      className={`chip${item.id === draw.id ? ' active' : ''}`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      {item.nameAr}
                      <Pill tone={DRAW_STATE[item.state].tone}>{DRAW_STATE[item.state].label}</Pill>
                    </button>
                  ))}
                </div>

                <div className="grid grid-kpi">
                  <StatTile
                    label="حالة السحب"
                    value={<Pill tone={state.tone}>{state.label}</Pill>}
                    hint={`${formatDateAr(draw.opensAt)} — ${formatDateAr(draw.closesAt)}`}
                  />
                  <StatTile
                    label="الكوبونات المؤهلة"
                    value={formatNumber(draw.entryCount)}
                    icon={<Ticket size={15} />}
                    tone="gold"
                  />
                  <StatTile
                    label="عدد الجوائز"
                    value={formatNumber(prizes.data?.length ?? 0)}
                    hint={`${totalWinners} فائز متوقع`}
                    icon={<Gift size={15} />}
                  />
                  <StatTile
                    label="الفائزون"
                    value={formatNumber(winners.data?.length ?? 0)}
                    hint={`${(winners.data ?? []).filter((w) => w.claimed).length} استلموا جوائزهم`}
                    icon={<Trophy size={15} />}
                  />
                </div>

                {canRun ? (
                  <div className="row row-gap-3 wrap">
                    {draw.state === 'open' || draw.state === 'draft' ? (
                      <Button
                        variant="primary"
                        icon={<Dices size={16} />}
                        onClick={() => setConfirmRun(true)}
                        disabled={(prizes.data?.length ?? 0) === 0}
                      >
                        إجراء السحب الآن
                      </Button>
                    ) : null}
                    {draw.state === 'drawn' ? (
                      <Button variant="primary" icon={<Megaphone size={16} />} onClick={() => setConfirmPublish(true)}>
                        نشر النتائج في التطبيق
                      </Button>
                    ) : null}
                    <Button variant="outline" icon={<Pencil size={15} />} onClick={() => setEditingDraw(draw)}>
                      تعديل بيانات السحب
                    </Button>
                  </div>
                ) : null}

                {draw.state === 'published' ? (
                  <Notice tone="success">
                    النتائج منشورة منذ {formatDateAr(draw.publishedAt)} وتظهر للمشتركين داخل شاشة
                    السحوبات.
                  </Notice>
                ) : null}

                <div className="split">
                  <Card>
                    <CardHead
                      title="الجوائز"
                      subtitle="كل مستوى جائزة يسحب العدد المحدد من الكوبونات"
                      actions={
                        canRun && draw.state !== 'published' ? (
                          <Button variant="subtle" size="sm" icon={<Plus size={13} />} onClick={() => setEditingPrize('new')}>
                            إضافة جائزة
                          </Button>
                        ) : null
                      }
                    />
                    <AsyncBlock state={prizes} emptyWhen={(rows2) => rows2.length === 0} empty={<EmptyState title="ما بيها جوائز بعد" hint="أضف الجوائز قبل إجراء السحب" icon={<Gift size={22} />} />}>
                      {(rows2) =>
                        rows2.map((prize) => (
                          <div
                            key={prize.id}
                            className="row row-gap-3 wrap"
                            style={{ padding: 'var(--sp-3) var(--sp-5)', borderBottom: '1px solid var(--divider)' }}
                          >
                            <span
                              className="crest"
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 'var(--r-chip)',
                                background: GRADIENT_SWATCHES[prize.gradientIndex],
                              }}
                            >
                              <Package size={16} />
                            </span>
                            <div className="col grow" style={{ lineHeight: 1.35, minWidth: 140 }}>
                              <span className="fs-13 strong">{prize.titleAr}</span>
                              <span className="fs-11 dim">{prize.subtitleAr}</span>
                            </div>
                            {prize.rank ? (
                              <Pill tone="gold">
                                <Award size={11} />
                                المركز {prize.rank}
                              </Pill>
                            ) : null}
                            <span className="fs-13 num strong">{prize.winnersCount}</span>
                            {canRun && draw.state !== 'published' ? (
                              <div className="row row-gap-1">
                                <Button variant="ghost" size="sm" icon={<Pencil size={13} />} onClick={() => setEditingPrize(prize)} />
                                <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => setDeletingPrize(prize)} />
                              </div>
                            ) : null}
                          </div>
                        ))
                      }
                    </AsyncBlock>
                  </Card>

                  <Card>
                    <CardHead title="الفائزون" subtitle="الاسم يظهر للمشترك بصيغة مخفية جزئياً" />
                    <AsyncBlock
                      state={winners}
                      emptyWhen={(rows2) => rows2.length === 0}
                      empty={<EmptyState title="ما انسحب بعد" icon={<Trophy size={22} />} />}
                    >
                      {(rows2) =>
                        rows2.map((winner) => (
                          <div
                            key={winner.id}
                            className="col"
                            style={{ padding: 'var(--sp-3) var(--sp-5)', borderBottom: '1px solid var(--divider)', gap: 5 }}
                          >
                            <div className="row between row-gap-2">
                              <span className="fs-13 strong">{winner.userName}</span>
                              <Switch
                                checked={winner.claimed}
                                onChange={(next) => void toggleClaimed(winner.id, next)}
                                label={winner.claimed ? 'مستلمة' : 'ما استلمها'}
                                disabled={!canRun}
                              />
                            </div>
                            <span className="fs-12 muted">{winner.prizeTitle}</span>
                            <div className="row between fs-11 dim">
                              <span className="num">{winner.couponCode}</span>
                              <span>{winner.maskedName}</span>
                            </div>
                          </div>
                        ))
                      }
                    </AsyncBlock>
                  </Card>
                </div>
              </>
            );
          }}
        </AsyncBlock>
      </div>

      {editingDraw ? (
        <DrawDialog
          draw={editingDraw === 'new' ? null : editingDraw}
          onClose={() => setEditingDraw(null)}
          onSaved={() => {
            setEditingDraw(null);
            draws.reload();
          }}
        />
      ) : null}

      {editingPrize && current ? (
        <PrizeDialog
          prize={editingPrize === 'new' ? null : editingPrize}
          drawId={current.id}
          onClose={() => setEditingPrize(null)}
          onSaved={() => {
            setEditingPrize(null);
            prizes.reload();
          }}
        />
      ) : null}

      {confirmRun && current ? (
        <ConfirmDialog
          title="إجراء السحب"
          danger
          confirmLabel="إجراء السحب"
          pending={busy}
          onConfirm={() => void runDraw()}
          onCancel={() => setConfirmRun(false)}
          message={
            <>
              راح ينسحب <span className="num strong">{totalWinners}</span> فائز عشوائياً من{' '}
              <span className="num strong">{current.entryCount}</span> كوبون مؤهل.
              <br />
              <span className="strong" style={{ color: 'var(--danger)' }}>
                السحب ما ينعاد.
              </span>{' '}
              إذا صار خطأ، الحل هو إنشاء سحب جديد — حتى يبقى الاثنين موثقين بسجل العمليات.
            </>
          }
        />
      ) : null}

      {confirmPublish ? (
        <ConfirmDialog
          title="نشر النتائج"
          message="راح تظهر أسماء الفائزين داخل شاشة السحوبات في التطبيق لكل المشتركين."
          confirmLabel="نشر"
          pending={busy}
          onConfirm={() => void publish()}
          onCancel={() => setConfirmPublish(false)}
        />
      ) : null}

      {deletingPrize ? (
        <ConfirmDialog
          title="حذف الجائزة"
          message={`راح تنحذف جائزة ${deletingPrize.titleAr}.`}
          confirmLabel="حذف"
          danger
          pending={busy}
          onConfirm={() => void removePrize()}
          onCancel={() => setDeletingPrize(null)}
        />
      ) : null}
    </>
  );
}

function DrawDialog({
  draw,
  onClose,
  onSaved,
}: {
  draw: Draw | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();
  const year = new Date().getFullYear().toString();

  const [nameAr, setNameAr] = useState(draw?.nameAr ?? `سحب سلفرسات السنوي ${year}`);
  const [drawYear, setDrawYear] = useState(draw?.year ?? year);
  const [opensAt, setOpensAt] = useState((draw?.opensAt ?? `${year}-01-01T00:00:00.000Z`).slice(0, 10));
  const [closesAt, setClosesAt] = useState((draw?.closesAt ?? `${year}-12-31T23:59:00.000Z`).slice(0, 10));

  const submit = async () => {
    const ok = await run(() =>
      repos.draws.saveDraw({
        id: draw?.id,
        nameAr,
        year: drawYear,
        state: draw?.state ?? 'open',
        opensAt: new Date(opensAt).toISOString(),
        closesAt: new Date(`${closesAt}T23:59:59`).toISOString(),
        drawnAt: draw?.drawnAt ?? null,
        publishedAt: draw?.publishedAt ?? null,
        governorateIds: draw?.governorateIds ?? [],
      }),
    );
    if (ok) {
      toast(draw ? 'انحفظ السحب' : 'انضاف السحب');
      onSaved();
    }
  };

  return (
    <Modal
      title={draw ? 'تعديل السحب' : 'سحب جديد'}
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
        <Field label="اسم السحب">
          <TextInput value={nameAr} onChange={setNameAr} />
        </Field>
        <Field label="سنة الكوبونات المؤهلة" hint="الكوبونات الصادرة بهذه السنة فقط تدخل السحب">
          <TextInput value={drawYear} onChange={setDrawYear} />
        </Field>
        <div className="grid grid-form">
          <Field label="يبدأ في">
            <TextInput type="date" value={opensAt} onChange={setOpensAt} />
          </Field>
          <Field label="يغلق في">
            <TextInput type="date" value={closesAt} onChange={setClosesAt} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function PrizeDialog({
  prize,
  drawId,
  onClose,
  onSaved,
}: {
  prize: Prize | null;
  drawId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [titleAr, setTitleAr] = useState(prize?.titleAr ?? '');
  const [subtitleAr, setSubtitleAr] = useState(prize?.subtitleAr ?? '');
  const [iconKey, setIconKey] = useState<IconKey>(prize?.iconKey ?? 'gift');
  const [gradientIndex, setGradientIndex] = useState<GradientIndex>(prize?.gradientIndex ?? 0);
  const [winnersCount, setWinnersCount] = useState(String(prize?.winnersCount ?? 1));
  const [rank, setRank] = useState<string>(prize?.rank ? String(prize.rank) : '');

  const submit = async () => {
    if (!titleAr.trim()) {
      toast('اكتب اسم الجائزة', 'error');
      return;
    }
    const ok = await run(() =>
      repos.draws.savePrize({
        id: prize?.id,
        drawId,
        iconKey,
        titleAr: titleAr.trim(),
        subtitleAr: subtitleAr.trim(),
        rank: rank ? (Number(rank) as 1 | 2 | 3) : undefined,
        gradientIndex,
        winnersCount: Math.max(1, Number(winnersCount)),
        sortOrder: prize?.sortOrder ?? 0,
      }),
    );
    if (ok) {
      toast(prize ? 'انحفظت الجائزة' : 'انضافت الجائزة');
      onSaved();
    }
  };

  return (
    <Modal
      title={prize ? 'تعديل الجائزة' : 'إضافة جائزة'}
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

        <Field label="اسم الجائزة">
          <TextInput value={titleAr} onChange={setTitleAr} placeholder="شاشة سمارت 65 بوصة" />
        </Field>
        <Field label="الوصف المختصر">
          <TextInput value={subtitleAr} onChange={setSubtitleAr} placeholder="الجائزة الكبرى · فائز واحد" />
        </Field>

        <div className="grid grid-form">
          <Field label="عدد الفائزين">
            <TextInput type="number" min={1} max={500} value={winnersCount} onChange={setWinnersCount} />
          </Field>
          <Field label="مستوى الجائزة" hint="المراكز 1-2-3 تُعرض بشارة ذهبية">
            <Select
              value={rank}
              onChange={setRank}
              options={[
                { value: '', label: 'بدون مركز' },
                { value: '1', label: 'المركز الأول' },
                { value: '2', label: 'المركز الثاني' },
                { value: '3', label: 'المركز الثالث' },
              ]}
            />
          </Field>
        </div>

        <Field label="الأيقونة">
          <Select
            value={iconKey}
            onChange={(next) => setIconKey(next as IconKey)}
            options={ICON_KEYS}
          />
        </Field>

        <Field label="لون البطاقة داخل التطبيق">
          <div className="row row-gap-2 wrap">
            {GRADIENT_SWATCHES.map((swatch, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setGradientIndex(index as GradientIndex)}
                style={{
                  width: 44,
                  height: 30,
                  borderRadius: 'var(--r-chip)',
                  background: swatch,
                  border:
                    gradientIndex === index
                      ? '2px solid var(--brand-deep)'
                      : '1px solid var(--hairline)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
