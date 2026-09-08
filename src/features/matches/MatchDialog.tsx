/**
 * Create / edit a fixture.
 *
 * The prediction switch lives here too, with its own explicit close time —
 * the table switch uses the default (kickoff), this dialog is where an
 * operator sets an earlier lock for a match they expect trouble on.
 */

import { useMemo, useState } from 'react';
import { useRepos } from '@/app/RepositoryContext';
import { useAsync, useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { Button, Field, Modal, Notice, Select, Switch, TextArea, TextInput } from '@/components/ui';
import type { Id, MatchState, MatchView } from '@/types';

/** ISO -> the value shape a datetime-local input wants (local time, no zone). */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  return value ? new Date(value).toISOString() : '';
}

export function MatchDialog({
  match,
  onClose,
  onSaved,
}: {
  match: MatchView | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const leagues = useAsync(() => repos.catalog.leagues(), []);
  const teams = useAsync(() => repos.catalog.teams(), []);

  const [leagueId, setLeagueId] = useState<Id>(match?.leagueId ?? '');
  const [homeTeamId, setHomeTeamId] = useState<Id>(match?.homeTeamId ?? '');
  const [awayTeamId, setAwayTeamId] = useState<Id>(match?.awayTeamId ?? '');
  const [kickoff, setKickoff] = useState(toLocalInput(match?.kickoffAt ?? null));
  const [state, setState] = useState<MatchState>(match?.state ?? 'scheduled');
  const [openForPredict, setOpenForPredict] = useState(match?.openForPredict ?? false);
  const [closeAt, setCloseAt] = useState(toLocalInput(match?.predictionCloseAt ?? null));
  const [featured, setFeatured] = useState(match?.featured ?? false);
  const [note, setNote] = useState(match?.note ?? '');

  // Teams are filtered to the chosen league — cross-league fixtures are not a
  // thing this product supports, and the unfiltered list is 29 entries long.
  const leagueTeams = useMemo(
    () => (teams.data ?? []).filter((team) => !leagueId || team.leagueId === leagueId),
    [teams.data, leagueId],
  );

  const save = async () => {
    if (!leagueId || !homeTeamId || !awayTeamId || !kickoff) {
      toast('كمّل الدوري والفريقين وموعد الانطلاق', 'error');
      return;
    }
    const ok = await run(() =>
      repos.matches.save({
        id: match?.id,
        leagueId,
        homeTeamId,
        awayTeamId,
        kickoffAt: fromLocalInput(kickoff),
        state,
        homeScore: match?.homeScore ?? null,
        awayScore: match?.awayScore ?? null,
        liveMinute: match?.liveMinute,
        openForPredict,
        predictionCloseAt: openForPredict ? fromLocalInput(closeAt || kickoff) : null,
        featured,
        note: note.trim() || undefined,
      }),
    );
    if (ok) {
      toast(match ? 'انحفظت التعديلات' : 'انضافت المباراة');
      onSaved();
    }
  };

  return (
    <Modal
      title={match ? 'تعديل المباراة' : 'إضافة مباراة'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="primary" onClick={() => void save()} disabled={action.pending}>
            {action.pending ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-4)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <Field label="الدوري">
          <Select
            value={leagueId}
            onChange={(next) => {
              setLeagueId(next);
              // Teams from the old league would no longer be valid choices.
              setHomeTeamId('');
              setAwayTeamId('');
            }}
            options={[
              { value: '', label: 'اختر الدوري' },
              ...(leagues.data ?? []).map((league) => ({ value: league.id, label: league.nameAr })),
            ]}
          />
        </Field>

        <div className="grid grid-form">
          <Field label="الفريق المضيف">
            <Select
              value={homeTeamId}
              onChange={setHomeTeamId}
              options={[
                { value: '', label: 'اختر الفريق' },
                ...leagueTeams.map((team) => ({ value: team.id, label: team.nameAr })),
              ]}
            />
          </Field>
          <Field label="الفريق الضيف">
            <Select
              value={awayTeamId}
              onChange={setAwayTeamId}
              options={[
                { value: '', label: 'اختر الفريق' },
                ...leagueTeams.map((team) => ({ value: team.id, label: team.nameAr })),
              ]}
            />
          </Field>
        </div>

        <div className="grid grid-form">
          <Field label="موعد الانطلاق">
            <TextInput type="datetime-local" value={kickoff} onChange={setKickoff} />
          </Field>
          <Field label="حالة المباراة">
            <Select
              value={state}
              onChange={setState}
              options={[
                { value: 'scheduled' as const, label: 'مجدولة' },
                { value: 'live' as const, label: 'مباشر' },
                { value: 'finished' as const, label: 'منتهية' },
                { value: 'postponed' as const, label: 'مؤجلة' },
                { value: 'cancelled' as const, label: 'ملغاة' },
              ]}
            />
          </Field>
        </div>

        <div className="card card-pad col" style={{ gap: 'var(--sp-3)', background: 'var(--bg-app)' }}>
          <Switch
            checked={openForPredict}
            onChange={setOpenForPredict}
            label="افتح هذه المباراة للتوقع داخل التطبيق"
            disabled={state !== 'scheduled'}
          />
          {state !== 'scheduled' ? (
            <span className="fs-12 dim">التوقع ينفتح فقط على مباراة مجدولة.</span>
          ) : openForPredict ? (
            <Field
              label="آخر وقت لاستلام التوقعات"
              hint="اتركه فارغ ليقفل تلقائياً عند صافرة البداية"
            >
              <TextInput type="datetime-local" value={closeAt} onChange={setCloseAt} />
            </Field>
          ) : null}
        </div>

        <Switch checked={featured} onChange={setFeatured} label="ثبّت المباراة في الشاشة الرئيسية" />

        <Field label="ملاحظة داخلية" hint="ما تظهر للمشترك — للفريق فقط">
          <TextArea value={note} onChange={setNote} rows={2} placeholder="مثلاً: مؤجلة بسبب الأحوال الجوية" />
        </Field>
      </div>
    </Modal>
  );
}
