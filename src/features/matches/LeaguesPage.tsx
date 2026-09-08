/**
 * Leagues and their teams.
 *
 * Two panes rather than two screens: a team only exists inside a league, and
 * the operator's real task is "make sure both teams exist before I add the
 * fixture", which reads badly when split across navigation.
 *
 * Deleting is refused by the repository once a league or team carries
 * fixtures — history would lose its labels. The screen surfaces that message
 * and offers deactivation instead.
 */

import { useState } from 'react';
import { ClipboardList, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
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
  SearchInput,
  Select,
  Switch,
  TeamCrest,
  TextInput,
} from '@/components/ui';
import type { Id, League, Team } from '@/types';
import { formatNumber } from '@/lib/format';
import { matchesSearch } from '@/lib/utils';

export function LeaguesPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [selectedLeagueId, setSelectedLeagueId] = useState<Id | null>(null);
  const [search, setSearch] = useState('');
  const [editingLeague, setEditingLeague] = useState<League | 'new' | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | 'new' | null>(null);
  const [deleting, setDeleting] = useState<{ kind: 'league' | 'team'; id: Id; name: string } | null>(
    null,
  );
  const [run, action] = useAction();

  const leagues = useAsync(() => repos.catalog.leagues(), []);
  const teams = useAsync(() => repos.catalog.teams(), []);

  // The first league stands in until the operator picks one.
  const activeLeagueId = selectedLeagueId ?? leagues.data?.[0]?.id ?? null;
  const activeLeague = leagues.data?.find((l) => l.id === activeLeagueId) ?? null;

  const leagueTeams = (teams.data ?? [])
    .filter((team) => team.leagueId === activeLeagueId)
    .filter((team) => matchesSearch(team.nameAr, search));

  const teamCount = (leagueId: Id) =>
    (teams.data ?? []).filter((t) => t.leagueId === leagueId).length;

  const confirmDelete = async () => {
    if (!deleting) return;
    const ok = await run(() =>
      deleting.kind === 'league'
        ? repos.catalog.deleteLeague(deleting.id)
        : repos.catalog.deleteTeam(deleting.id),
    );
    if (ok) {
      toast(deleting.kind === 'league' ? 'انحذف الدوري' : 'انحذف الفريق');
      setDeleting(null);
      leagues.reload();
      teams.reload();
    }
  };

  const toggleLeague = async (league: League, active: boolean) => {
    await run(() => repos.catalog.saveLeague({ ...league, active }));
    leagues.reload();
  };

  return (
    <>
      <PageHeader
        title="الدوريات والفرق"
        subtitle="الدوريات المتاحة للتوقع والفرق اللي تنبنى منها المباريات"
        actions={
          <>
            <Button variant="outline" icon={<Plus size={16} />} onClick={() => setEditingTeam('new')}>
              إضافة فريق
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditingLeague('new')}>
              إضافة دوري
            </Button>
          </>
        }
      />

      <div className="page">
        <div className="split">
          <Card>
            <CardHead title="الدوريات" subtitle={`${formatNumber(leagues.data?.length ?? 0)} دوري`} />
            <AsyncBlock
              state={leagues}
              emptyWhen={(rows) => rows.length === 0}
              empty={<EmptyState title="ما بيها دوريات" icon={<ClipboardList size={22} />} />}
            >
              {(rows) => (
                <div className="col">
                  {rows.map((league) => (
                    <button
                      key={league.id}
                      className={`nav-link${league.id === activeLeagueId ? ' active' : ''}`}
                      style={{ width: '100%', textAlign: 'start' }}
                      onClick={() => {
                        setSelectedLeagueId(league.id);
                        setSearch('');
                      }}
                    >
                      <ClipboardList size={16} />
                      <span className="grow truncate">{league.nameAr}</span>
                      <span className="fs-11 dim num">{formatNumber(teamCount(league.id))}</span>
                      {!league.active ? <Pill tone="muted">معطّل</Pill> : null}
                    </button>
                  ))}
                </div>
              )}
            </AsyncBlock>
          </Card>

          <Card>
            <CardHead
              title={activeLeague ? `فرق ${activeLeague.nameAr}` : 'الفرق'}
              subtitle={activeLeague?.country}
              actions={
                activeLeague ? (
                  <>
                    <Switch
                      checked={activeLeague.active}
                      onChange={(next) => void toggleLeague(activeLeague, next)}
                      label="مفعّل"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Pencil size={13} />}
                      onClick={() => setEditingLeague(activeLeague)}
                    >
                      تعديل الدوري
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={13} />}
                      title="حذف الدوري"
                      onClick={() =>
                        setDeleting({ kind: 'league', id: activeLeague.id, name: activeLeague.nameAr })
                      }
                    />
                  </>
                ) : null
              }
            />

            <div className="card-pad col" style={{ gap: 'var(--sp-4)' }}>
              {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

              <SearchInput value={search} onChange={setSearch} placeholder="بحث باسم الفريق…" />

              <AsyncBlock state={teams}>
                {() =>
                  leagueTeams.length === 0 ? (
                    <EmptyState
                      title="ما بيها فرق بهذا الدوري"
                      hint="أضف الفرق قبل ما تسوي مباريات عليها."
                      icon={<Users size={22} />}
                      action={
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<Plus size={14} />}
                          onClick={() => setEditingTeam('new')}
                        >
                          إضافة فريق
                        </Button>
                      }
                    />
                  ) : (
                    <div className="grid grid-2">
                      {leagueTeams.map((team) => (
                        <div key={team.id} className="row row-gap-3 card card-pad">
                          <TeamCrest name={team.nameAr} seed={team.crestSeed} size={34} />
                          <div className="col grow" style={{ lineHeight: 1.35, minWidth: 0 }}>
                            <span className="fs-13 strong truncate">{team.nameAr}</span>
                            <span className="fs-11 dim">{team.shortNameAr}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Pencil size={13} />}
                            title="تعديل"
                            onClick={() => setEditingTeam(team)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 size={13} />}
                            title="حذف"
                            onClick={() => setDeleting({ kind: 'team', id: team.id, name: team.nameAr })}
                          />
                        </div>
                      ))}
                    </div>
                  )
                }
              </AsyncBlock>
            </div>
          </Card>
        </div>
      </div>

      {editingLeague ? (
        <LeagueDialog
          league={editingLeague === 'new' ? null : editingLeague}
          onClose={() => setEditingLeague(null)}
          onSaved={() => {
            setEditingLeague(null);
            leagues.reload();
          }}
        />
      ) : null}

      {editingTeam ? (
        <TeamDialog
          team={editingTeam === 'new' ? null : editingTeam}
          leagues={leagues.data ?? []}
          defaultLeagueId={activeLeagueId}
          onClose={() => setEditingTeam(null)}
          onSaved={() => {
            setEditingTeam(null);
            teams.reload();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={deleting.kind === 'league' ? 'حذف الدوري' : 'حذف الفريق'}
          message={
            <>
              راح ينحذف <span className="strong">{deleting.name}</span>. إذا عليه مباريات مسجلة راح
              ينرفض الحذف — بهذه الحالة عطّله بدل ما تحذفه.
            </>
          }
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

function LeagueDialog({
  league,
  onClose,
  onSaved,
}: {
  league: League | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [nameAr, setNameAr] = useState(league?.nameAr ?? '');
  const [key, setKey] = useState(league?.key ?? '');
  const [country, setCountry] = useState(league?.country ?? '');
  const [active, setActive] = useState(league?.active ?? true);

  const submit = async () => {
    if (!nameAr.trim() || !key.trim()) {
      toast('الاسم والمفتاح مطلوبين', 'error');
      return;
    }
    const ok = await run(() =>
      repos.catalog.saveLeague({
        id: league?.id,
        key: key.trim(),
        nameAr: nameAr.trim(),
        country: country.trim(),
        active,
        sortOrder: league?.sortOrder ?? 0,
      }),
    );
    if (ok) {
      toast(league ? 'انحفظ الدوري' : 'انضاف الدوري');
      onSaved();
    }
  };

  return (
    <Modal
      title={league ? 'تعديل الدوري' : 'إضافة دوري'}
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

        <Field label="اسم الدوري">
          <TextInput value={nameAr} onChange={setNameAr} placeholder="الدوري العراقي الممتاز" />
        </Field>
        <div className="grid grid-form">
          <Field label="المفتاح" hint="حروف لاتينية — التطبيق يجمّع بيه المباريات">
            <TextInput value={key} onChange={setKey} placeholder="iraqi" />
          </Field>
          <Field label="البلد">
            <TextInput value={country} onChange={setCountry} placeholder="العراق" />
          </Field>
        </div>
        <Switch checked={active} onChange={setActive} label="ظاهر داخل التطبيق" />
      </div>
    </Modal>
  );
}

function TeamDialog({
  team,
  leagues,
  defaultLeagueId,
  onClose,
  onSaved,
}: {
  team: Team | null;
  leagues: League[];
  defaultLeagueId: Id | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const { toast } = useToast();
  const [run, action] = useAction();

  const [nameAr, setNameAr] = useState(team?.nameAr ?? '');
  const [shortNameAr, setShortNameAr] = useState(team?.shortNameAr ?? '');
  const [leagueId, setLeagueId] = useState<Id>(
    team?.leagueId ?? defaultLeagueId ?? leagues[0]?.id ?? '',
  );
  const [crestSeed, setCrestSeed] = useState(team?.crestSeed ?? 0);

  const submit = async () => {
    if (!nameAr.trim() || !leagueId) {
      toast('اسم الفريق والدوري مطلوبين', 'error');
      return;
    }
    const ok = await run(() =>
      repos.catalog.saveTeam({
        id: team?.id,
        nameAr: nameAr.trim(),
        shortNameAr: (shortNameAr.trim() || nameAr.trim()).slice(0, 12),
        leagueId,
        crestSeed,
      }),
    );
    if (ok) {
      toast(team ? 'انحفظ الفريق' : 'انضاف الفريق');
      onSaved();
    }
  };

  return (
    <Modal
      title={team ? 'تعديل الفريق' : 'إضافة فريق'}
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

        <Field label="اسم الفريق">
          <TextInput value={nameAr} onChange={setNameAr} placeholder="نادي الزوراء" />
        </Field>
        <div className="grid grid-form">
          <Field label="الاسم المختصر" hint="اللي يظهر ببطاقة المباراة">
            <TextInput value={shortNameAr} onChange={setShortNameAr} placeholder="الزوراء" />
          </Field>
          <Field label="الدوري">
            <Select
              value={leagueId}
              onChange={setLeagueId}
              options={leagues.map((l) => ({ value: l.id, label: l.nameAr }))}
            />
          </Field>
        </div>

        <Field label="شعار الفريق" hint="التطبيق يرسم حرف الاسم على تدرّج — اختر التدرّج">
          <div className="row row-gap-2 wrap">
            {Array.from({ length: 8 }).map((_, seed) => (
              <button
                key={seed}
                type="button"
                onClick={() => setCrestSeed(seed)}
                style={{
                  background: 'transparent',
                  border:
                    crestSeed === seed ? '2px solid var(--brand-deep)' : '1px solid var(--hairline)',
                  borderRadius: 'var(--r-chip)',
                  padding: 3,
                  cursor: 'pointer',
                  lineHeight: 0,
                }}
              >
                <TeamCrest name={nameAr || 'ف'} seed={seed} size={30} />
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
