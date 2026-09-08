/**
 * Live score + finish + un-settle.
 *
 * Written for speed during a match: two number steppers and a minute box, so
 * an operator can push a goal in three taps without re-reading the form.
 */

import { useState } from 'react';
import { Minus, Plus, RotateCcw, Save, Trophy } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { Button, Field, Modal, Notice, TeamCrest, TextInput } from '@/components/ui';
import type { MatchView } from '@/types';
import { formatDateTimeAr } from '@/lib/format';

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

export function LiveScoreDialog({
  match,
  onClose,
  onSaved,
}: {
  match: MatchView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [home, setHome] = useState(match.homeScore ?? 0);
  const [away, setAway] = useState(match.awayScore ?? 0);
  const [minute, setMinute] = useState(match.liveMinute?.replace("'", '') ?? '45');

  const pushLive = async () => {
    const ok = await run(() => repos.matches.updateLiveScore(match.id, home, away, `${minute}'`));
    if (ok) {
      toast('انحدثت النتيجة المباشرة');
      onSaved();
    }
  };

  const finish = async () => {
    const ok = await run(() => repos.matches.finish(match.id, home, away));
    if (ok) {
      toast('انتهت المباراة — تكدر تحتسب النقاط الآن');
      onSaved();
    }
  };

  const unsettle = async () => {
    const ok = await run(() => repos.matches.unsettle(match.id));
    if (ok) {
      toast('انسحبت النقاط ورجعت التوقعات لحالة الانتظار');
      onSaved();
    }
  };

  return (
    <Modal
      title="النتيجة المباشرة"
      onClose={onClose}
      footer={
        <>
          {match.state !== 'finished' ? (
            <Button variant="primary" icon={<Save size={15} />} disabled={action.pending} onClick={() => void pushLive()}>
              حفظ النتيجة المباشرة
            </Button>
          ) : null}
          <Button variant="outline" icon={<Trophy size={15} />} disabled={action.pending} onClick={() => void finish()}>
            {match.state === 'finished' ? 'تعديل النتيجة النهائية' : 'إنهاء المباراة'}
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
          <span className="fs-12 muted">{match.league.nameAr}</span>
          <span className="fs-12 dim num">{formatDateTimeAr(match.kickoffAt)}</span>
        </div>

        <div className="row" style={{ gap: 'var(--sp-4)' }}>
          <Stepper
            label={match.homeTeam.nameAr}
            seed={match.homeTeam.crestSeed}
            value={home}
            onChange={setHome}
          />
          <span className="fs-20 dim" style={{ alignSelf: 'center' }}>
            –
          </span>
          <Stepper
            label={match.awayTeam.nameAr}
            seed={match.awayTeam.crestSeed}
            value={away}
            onChange={setAway}
          />
        </div>

        {match.state !== 'finished' ? (
          <Field label="الدقيقة" hint="تظهر داخل شارة المباشر في التطبيق">
            <TextInput type="number" min={0} max={130} value={minute} onChange={setMinute} />
          </Field>
        ) : null}

        {match.settledAt ? (
          <Notice tone="warning">
            <div className="col" style={{ gap: 'var(--sp-2)' }}>
              <span>
                نقاط هذه المباراة محتسبة مسبقاً. إذا كانت النتيجة غلط، تراجع عن الاحتساب أولاً ثم صحّح
                النتيجة وأعد الاحتساب.
              </span>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<RotateCcw size={13} />}
                  disabled={action.pending}
                  onClick={() => void unsettle()}
                >
                  تراجع عن احتساب النقاط
                </Button>
              </div>
            </div>
          </Notice>
        ) : null}
      </div>
    </Modal>
  );
}
