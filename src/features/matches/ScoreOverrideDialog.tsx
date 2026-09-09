/**
 * Manual score correction.
 *
 * Scores arrive from the fixtures feed, so this dialog is the exception, not
 * the routine: it exists because points are paid out on the score, and a feed
 * that is wrong or twenty minutes behind will otherwise settle real points on
 * a wrong result.
 *
 * Correcting a score pins it — later syncs stop touching this fixture — which
 * is a commitment worth stating in the dialog rather than hiding, along with
 * the way back to the feed once the feed is right again.
 */

import { useState } from 'react';
import { Minus, Plus, RotateCcw, Trophy, Radio } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { Button, Field, Modal, Notice, Pill, TeamCrest, TextInput } from '@/components/ui';
import type { MatchView } from '@/types';
import { formatDateTimeAr, relativeAr } from '@/lib/format';

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

  const saveLive = async () => {
    const ok = await run(() =>
      repos.matches.overrideScore(match.id, home, away, 'live', `${minute}'`),
    );
    if (ok) {
      toast('انحفظت النتيجة — المزوّد ما راح يغيّرها');
      onSaved();
    }
  };

  const saveFinished = async () => {
    const ok = await run(() => repos.matches.overrideScore(match.id, home, away, 'finished'));
    if (ok) {
      toast('انتهت المباراة بالنتيجة المصححة — تكدر تحتسب النقاط الآن');
      onSaved();
    }
  };

  const backToFeed = async () => {
    const ok = await run(() => repos.matches.clearScoreOverride(match.id));
    if (ok) {
      toast('رجعت النتيجة لمزوّد المباريات');
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
      title="تصحيح النتيجة يدوياً"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="primary"
            icon={<Radio size={15} />}
            disabled={action.pending || Boolean(match.settledAt)}
            onClick={() => void saveLive()}
          >
            حفظ كمباشر
          </Button>
          <Button
            variant="outline"
            icon={<Trophy size={15} />}
            disabled={action.pending || Boolean(match.settledAt)}
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
          <span className="fs-12 muted">{match.league.nameAr}</span>
          <span className="fs-12 dim num">{formatDateTimeAr(match.kickoffAt)}</span>
          <span className="fs-11 dim">
            آخر تحديث من المزوّد {relativeAr(match.syncedAt)}
          </span>
        </div>

        <Notice tone={match.scoreOverridden ? 'warning' : 'info'}>
          {match.scoreOverridden ? (
            <div className="col" style={{ gap: 'var(--sp-2)' }}>
              <span>
                نتيجة هذه المباراة مثبتة يدوياً — المزامنة ما تلمسها. إذا صار المزوّد صحيح، رجّعها له.
              </span>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<RotateCcw size={13} />}
                  disabled={action.pending}
                  onClick={() => void backToFeed()}
                >
                  رجّع النتيجة للمزوّد
                </Button>
              </div>
            </div>
          ) : (
            <span>
              النتيجة الآن تجي من <span className="strong">{match.league.nameAr}</span> عبر المزوّد. أي
              حفظ هنا يثبّتها ويوقف المزامنة عن هذه المباراة لحد ما ترجّعها.
            </span>
          )}
        </Notice>

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

        <Field label="الدقيقة" hint="تظهر داخل شارة المباشر في التطبيق — تنستخدم مع «حفظ كمباشر»">
          <TextInput type="number" min={0} max={130} value={minute} onChange={setMinute} />
        </Field>

        {match.settledAt ? (
          <Notice tone="warning">
            <div className="col" style={{ gap: 'var(--sp-2)' }}>
              <span>
                نقاط هذه المباراة محتسبة مسبقاً، فما تنعدّل النتيجة. تراجع عن الاحتساب أولاً، صحّح
                النتيجة، وبعدين أعد الاحتساب.
              </span>
              <div className="row row-gap-2">
                <Pill tone="success">محتسبة</Pill>
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
