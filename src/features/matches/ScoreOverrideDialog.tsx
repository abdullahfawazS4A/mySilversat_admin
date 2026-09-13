/**
 * Manual score correction.
 *
 * Scores arrive from the fixtures feed, so this dialog is the exception, not
 * the routine: it exists because points are paid out on the score, and a feed
 * that is wrong or twenty minutes behind will otherwise settle real points on
 * a wrong result.
 *
 * One thing the API does *not* do is pin a corrected score — there is no
 * override flag, so the next live sync can overwrite whatever is saved here.
 * The dialog says so plainly instead of implying a permanence it cannot give,
 * and points the operator at the order that actually works: correct, then
 * settle, immediately.
 */

import { useState } from 'react';
import { Minus, Plus, Radio, Trophy } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { Button, Field, Modal, Notice, TeamCrest, TextInput } from '@/components/ui';
import type { Match } from '@/types';
import { formatDateTimeAr } from '@/lib/format';

/** A crest seed from the team id, so the same team always gets the same look. */
function crestSeed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash;
}

function Stepper({
  label,
  seed,
  value,
  onChange,
}: {
  label: string;
  seed: number;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="col center" style={{ gap: 'var(--sp-3)', flex: 1 }}>
      <TeamCrest name={label} seed={seed} size={44} />
      <span className="fs-13 truncate" style={{ maxWidth: 140, textAlign: 'center' }}>
        {label}
      </span>
      <div className="row row-gap-3">
        <Button
          variant="outline"
          size="sm"
          icon={<Minus size={14} />}
          onClick={() => onChange(Math.max(0, value - 1))}
          title="ناقص"
        />
        <span className="fs-24 strong num" style={{ minWidth: 34, textAlign: 'center' }}>
          {value}
        </span>
        <Button
          variant="outline"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => onChange(Math.min(30, value + 1))}
          title="زائد"
        />
      </div>
    </div>
  );
}

export function ScoreOverrideDialog({
  match,
  onClose,
  onSaved,
}: {
  match: Match;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [home, setHome] = useState(match.homeScore ?? 0);
  const [away, setAway] = useState(match.awayScore ?? 0);
  const [minute, setMinute] = useState(String(match.currentMinute ?? 45));

  const saveLive = async () => {
    const ok = await run(() =>
      repos.matches.matches.setScore(match.id, home, away, 'live', Number(minute) || null),
    );
    if (ok) {
      toast('انحفظت النتيجة كمباشر');
      onSaved();
    }
  };

  const saveFinished = async () => {
    const ok = await run(() => repos.matches.matches.setScore(match.id, home, away, 'finished'));
    if (ok) {
      toast('انتهت المباراة بالنتيجة المصححة — تكدر تحتسب النقاط الآن');
      onSaved();
    }
  };

  return (
    <Modal
      title="تصحيح النتيجة يدوياً"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            icon={<Radio size={15} />}
            disabled={action.pending}
            onClick={() => void saveLive()}
          >
            حفظ كمباشر
          </Button>
          <Button
            variant="outline"
            icon={<Trophy size={15} />}
            disabled={action.pending}
            onClick={() => void saveFinished()}
          >
            حفظ كنتيجة نهائية
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إغلاق
          </Button>
        </>
      }
    >
      <div className="col" style={{ gap: 'var(--sp-5)' }}>
        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <div className="col" style={{ gap: 2 }}>
          <span className="fs-12 muted">{match.league?.name ?? ''}</span>
          <span className="fs-12 dim num">{formatDateTimeAr(match.matchAt)}</span>
        </div>

        <Notice tone="warning">
          التصحيح هنا ما يثبّت النتيجة — مزامنة المباشر الجاية تكدر ترجع تكتب عليها من المزوّد.
          إذا كنت تصحّح حتى تحتسب النقاط، احتسبها فوراً بعد الحفظ كنتيجة نهائية.
        </Notice>

        <div className="row" style={{ gap: 'var(--sp-4)' }}>
          <Stepper
            label={match.homeTeam?.name ?? '—'}
            seed={crestSeed(match.homeTeamId)}
            value={home}
            onChange={setHome}
          />
          <span className="fs-20 dim" style={{ alignSelf: 'center' }}>
            –
          </span>
          <Stepper
            label={match.awayTeam?.name ?? '—'}
            seed={crestSeed(match.awayTeamId)}
            value={away}
            onChange={setAway}
          />
        </div>

        <Field label="الدقيقة" hint="تظهر داخل شارة المباشر في التطبيق — تنستخدم مع «حفظ كمباشر»">
          <TextInput type="number" min={0} max={130} value={minute} onChange={setMinute} />
        </Field>
      </div>
    </Modal>
  );
}
