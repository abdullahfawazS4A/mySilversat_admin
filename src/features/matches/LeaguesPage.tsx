/**
 * Leagues and their teams.
 *
 * Everything on this screen belongs to the fixtures feed. Nothing here adds,
 * edits or deletes a league or a team — a wrong team name is fixed upstream
 * and arrives on the next sync, not typed over locally, because a local edit
 * would be silently reverted the moment the feed disagreed.
 *
 * Exactly one control is ours: whether a league reaches the app at all. The
 * feed keeps sending a switched-off league's fixtures and the console keeps
 * mirroring them — customers just never see them.
 */

import { useState } from 'react';
import { ClipboardList, RefreshCw, Users } from 'lucide-react';
import { useRepos } from '@/app/RepositoryContext';
import { useAction, useAsync } from '@/app/useAsync';
import { useToast } from '@/app/ToastContext';
import { PageHeader } from '@/components/page';
import {
  AsyncBlock,
  Button,
  Card,
  CardHead,
  EmptyState,
  Notice,
  Pill,
  SearchInput,
  Switch,
  TeamCrest,
} from '@/components/ui';
import type { Id, League } from '@/types';
import { formatNumber, relativeAr } from '@/lib/format';
import { matchesSearch } from '@/lib/utils';

export function LeaguesPage() {
  const repos = useRepos();
  const { toast } = useToast();

  const [selectedLeagueId, setSelectedLeagueId] = useState<Id | null>(null);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [run, action] = useAction();

  const leagues = useAsync(() => repos.catalog.leagues(), []);
  const teams = useAsync(() => repos.catalog.teams(), []);
  const settings = useAsync(() => repos.admin.settings(), []);

  // The first league stands in until the operator picks one.
  const activeLeagueId = selectedLeagueId ?? leagues.data?.[0]?.id ?? null;
  const activeLeague = leagues.data?.find((l) => l.id === activeLeagueId) ?? null;

  const leagueTeams = (teams.data ?? [])
    .filter((team) => team.leagueId === activeLeagueId)
    .filter((team) => matchesSearch(team.nameAr, search));

  const teamCount = (leagueId: Id) =>
    (teams.data ?? []).filter((t) => t.leagueId === leagueId).length;

  const toggleLeague = async (league: League, active: boolean) => {
    const ok = await run(() => repos.catalog.setLeagueActive(league.id, active));
    if (ok) {
      toast(active ? `${league.nameAr} صار يظهر بالتطبيق` : `${league.nameAr} انخفى من التطبيق`);
      leagues.reload();
    }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      await repos.matches.sync();
      toast('انمزامنت الدوريات والفرق من المزوّد');
      leagues.reload();
      teams.reload();
      settings.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّرت المزامنة', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const feed = settings.data?.matchFeed;

  return (
    <>
      <PageHeader
        title="الدوريات والفرق"
        subtitle="تجي جاهزة من مزوّد المباريات — للعرض فقط"
        actions={
          <Button
            variant="primary"
            icon={<RefreshCw size={16} />}
            disabled={syncing}
            onClick={() => void runSync()}
          >
            {syncing ? 'جاري المزامنة…' : 'مزامنة الآن'}
          </Button>
        }
      />

      <div className="page col" style={{ gap: 'var(--sp-4)' }}>
        {feed ? (
          <Notice tone={feed.lastSyncOk === false ? 'danger' : 'info'}>
            الدوريات والفرق ما تنضاف ولا تنعدّل من هنا — تجي من{' '}
            <span className="strong">{feed.providerName}</span>. أي اسم غلط ينصلّح عند المزوّد ويوصل
            بالمزامنة الجاية.
            {feed.lastSyncAt ? (
              <>
                {' '}آخر مزامنة <span className="num">{relativeAr(feed.lastSyncAt)}</span>.
              </>
            ) : null}
          </Notice>
        ) : null}

        {action.error ? <Notice tone="danger">{action.error}</Notice> : null}

        <div className="split split-rail">
          <Card>
            <CardHead title="الدوريات" subtitle={`${formatNumber(leagues.data?.length ?? 0)} دوري`} />
            <AsyncBlock
              state={leagues}
              emptyWhen={(rows) => rows.length === 0}
              empty={
                <EmptyState
                  title="ما بيها دوريات"
                  hint="سوّي مزامنة لجلب الدوريات من المزوّد."
                  icon={<ClipboardList size={22} />}
                />
              }
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
                      {!league.active ? <Pill tone="muted">مخفي</Pill> : null}
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
                  <div className="row row-gap-3">
                    <span className="fs-11 dim num" title="معرّف الدوري عند المزوّد">
                      {activeLeague.externalId}
                    </span>
                    <Switch
                      checked={activeLeague.active}
                      disabled={action.pending}
                      onChange={(next) => void toggleLeague(activeLeague, next)}
                      label="يظهر بالتطبيق"
                    />
                  </div>
                ) : null
              }
            />

            <div className="card-pad col" style={{ gap: 'var(--sp-4)' }}>
              <SearchInput value={search} onChange={setSearch} placeholder="بحث باسم الفريق…" />

              <AsyncBlock state={teams}>
                {() =>
                  leagueTeams.length === 0 ? (
                    <EmptyState
                      title="ما بيها فرق بهذا الدوري"
                      hint="الفرق توصل مع مزامنة المزوّد."
                      icon={<Users size={22} />}
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
                          <span className="fs-11 dim num" title="معرّف الفريق عند المزوّد">
                            {team.externalId}
                          </span>
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
    </>
  );
}
