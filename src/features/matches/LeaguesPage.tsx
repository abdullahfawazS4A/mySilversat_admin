/**
 * Leagues, teams and the whole fixture catalogue.
 *
 * All three are mirrored from API-Football and none is authored here, so the
 * create button is hidden: a row added by hand would carry no `externalId` and
 * the next sync would create the provider's own copy beside it. Editing is
 * still allowed, but only the columns the console owns are worth touching —
 * a league's display order and whether the app shows it at all.
 *
 * The sync itself lives on the API screen; this is where its result is read.
 *
 * The third tab is the catalogue view of the fixtures. «المباريات» in the
 * sidebar is the operating screen and shows only the leagues the app is
 * actually serving, so the unrestricted list — every league the feed mirrors,
 * switched on or not — belongs here beside the leagues and teams it is the
 * other half of. It is the same table component, opened on the wider scope.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Pencil } from 'lucide-react';
import {
  AsyncBlock,
  Button,
  Card,
  Field,
  FilterChips,
  Modal,
  Notice,
  Pill,
  SearchInput,
  Select,
  Switch,
  Tabs,
  TextInput,
  useDraft,
} from '@/components/ui';
import { BulkBar, DataTable, PageHeader, Toolbar } from '@/components/page';
import { useAction, useAsync, useDebounced } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import { useToast } from '@/app/ToastContext';
import type { Id, League, Team } from '@/types';
import type { LeagueInput, TeamInput } from '@/data/repositories/types';
import { leagueLabel } from '@/lib/labels';
import { CrudScreen } from '../shared/CrudScreen';
import { MatchesBoard } from './MatchesPage';

type Tab = 'leagues' | 'teams' | 'matches';

export function LeaguesPage() {
  const [tab, setTab] = useState<Tab>('leagues');

  return (
    <>
      <div className="page-wash" style={{ paddingBottom: 0 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'leagues', label: 'كل الدوريات' },
            { value: 'teams', label: 'كل الفرق' },
            { value: 'matches', label: 'كل المباريات' },
          ]}
        />
      </div>
      {tab === 'leagues' ? <LeaguesTab /> : null}
      {tab === 'teams' ? <TeamsTab /> : null}
      {tab === 'matches' ? <MatchesBoard scope="all" /> : null}
    </>
  );
}

/** Says, once per screen, that the rows come from the feed. */
function MirroredNotice({ what }: { what: string }) {
  return (
    <Notice tone="info">
      {what} تجي من مزوّد المباريات (API-Football) وتتحدّث بالمزامنة، فما ننشئها يدوياً.{' '}
      <Link to="/api">شغّل مزامنة من شاشة الـ API</Link>.
    </Notice>
  );
}

type ActiveFilter = 'all' | 'active' | 'hidden';

/**
 * The leagues tab.
 *
 * Hand-written rather than a `CrudScreen` because the job here is not editing
 * rows one at a time — it is deciding, across the twelve hundred leagues the
 * feed mirrors, which handful the app is allowed to show. Two are switched on
 * today, so a real session is "turn these few on" or "turn that long tail
 * off", and a screen whose only verb is a one-row dialog can do neither.
 *
 * So the visibility switch sits in the row, the selection drives a bulk
 * toggle, and the dialog is kept for what genuinely is per-league: the display
 * name and the order it sits in.
 */
function LeaguesTab() {
  const repos = useRepos();
  const { toast } = useToast();

  const countries = useAsync(() => repos.geo.countries.all(), []);
  const countryOptions = (countries.data ?? []).map((row) => ({ value: row.id, label: row.name }));

  const [countryId, setCountryId] = useState<Id>('');
  const [active, setActive] = useState<ActiveFilter>('all');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<League | null>(null);
  const [busy, setBusy] = useState(false);

  const leagues = useAsync(
    () =>
      repos.matches.leagues.list({
        search: debounced,
        countryId: countryId || undefined,
        isActive: active === 'all' ? undefined : active === 'active',
        page,
      }),
    [debounced, countryId, active, page],
  );

  const refresh = () => {
    leagues.reload();
    setSelected(new Set());
  };

  const toggle = async (league: League, next: boolean) => {
    try {
      await repos.matches.leagues.setActive(league.id, next);
      toast(next ? `${league.name} صار يظهر بالتطبيق` : `${league.name} انخفى من التطبيق`);
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر التغيير', 'error');
    }
  };

  const bulkToggle = async (next: boolean) => {
    setBusy(true);
    try {
      await repos.matches.leagues.bulkSetActive([...selected], next);
      toast(`${next ? 'انفعّل' : 'انخفى'} ${selected.size} دوري`);
      refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذّر التغيير', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="كل الدوريات"
        subtitle="كل دوريات المزوّد — اختار منها أي وحدة تنضاف للتطبيق وتظهر مبارياتها"
      />

      <div className="page">
        <MirroredNotice what="الدوريات" />

        <Card>
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="ابحث بدوري أو دولة…" />

            <Select<Id>
              value={countryId}
              onChange={(next) => {
                setCountryId(next);
                setPage(1);
              }}
              options={[{ value: '', label: 'كل الدول' }, ...countryOptions]}
            />

            <FilterChips
              value={active}
              onChange={(next) => {
                setActive(next);
                setPage(1);
              }}
              items={[
                { value: 'all', label: 'الكل' },
                { value: 'active', label: 'الظاهرة بالتطبيق' },
                { value: 'hidden', label: 'المخفية' },
              ]}
            />
          </Toolbar>

          {selected.size > 0 ? (
            <BulkBar count={selected.size}>
              <Button
                variant="primary"
                size="sm"
                icon={<Eye size={14} />}
                disabled={busy}
                onClick={() => void bulkToggle(true)}
              >
                إظهار بالتطبيق
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<EyeOff size={14} />}
                disabled={busy}
                onClick={() => void bulkToggle(false)}
              >
                إخفاء
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                إلغاء التحديد
              </Button>
            </BulkBar>
          ) : null}

          <AsyncBlock state={leagues}>
            {(data) => (
              <DataTable
                rows={data.items}
                rowKey={(row) => row.id}
                selectedIds={selected}
                onToggleSelect={(id) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onToggleSelectAll={(ids) =>
                  setSelected((current) =>
                    ids.every((id) => current.has(id)) ? new Set() : new Set(ids),
                  )
                }
                columns={[
                  {
                    key: 'isActive',
                    header: 'يظهر بالتطبيق',
                    width: 132,
                    render: (row) => (
                      <Switch
                        checked={row.isActive}
                        onChange={(next) => void toggle(row, next)}
                        title={
                          row.isActive
                            ? 'المخفي ما تظهر ولا مباراة من مبارياته'
                            : 'شغّله حتى تظهر مبارياته بالتطبيق'
                        }
                      />
                    ),
                  },
                  {
                    key: 'name',
                    header: 'الدوري',
                    render: (row) => <span className="strong">{row.name}</span>,
                  },
                  { key: 'country', header: 'الدولة', render: (row) => row.country?.name ?? '—' },
                  {
                    key: 'order',
                    header: 'الترتيب',
                    numeric: true,
                    width: 80,
                    render: (row) => <span className="num">{row.order}</span>,
                  },
                  {
                    key: 'external',
                    header: 'معرّف المزوّد',
                    numeric: true,
                    render: (row) =>
                      row.externalId === null ? (
                        <Pill tone="warning">يدوي</Pill>
                      ) : (
                        <span className="num dim">{row.externalId}</span>
                      ),
                  },
                  {
                    key: 'actions',
                    header: '',
                    width: 56,
                    render: (row) => (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Pencil size={14} />}
                        title="تعديل الاسم والترتيب"
                        onClick={() => setEditing(row)}
                      />
                    ),
                  },
                ]}
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
                empty={
                  <div className="empty">
                    <span className="strong">ما بيها دوريات بهذه الفلاتر</span>
                    <span className="fs-small muted">
                      {active === 'active'
                        ? 'ماكو ولا دوري ظاهر بالتطبيق — شغّل وحدة من قائمة «الكل»'
                        : 'غيّر الفلاتر أو شغّل مزامنة من شاشة الـ API'}
                    </span>
                  </div>
                }
              />
            )}
          </AsyncBlock>
        </Card>
      </div>

      {editing ? (
        <LeagueDialog
          league={editing}
          countryOptions={countryOptions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}

/** Edits the fields the console owns that are not the visibility switch. */
function LeagueDialog({
  league,
  countryOptions,
  onClose,
  onSaved,
}: {
  league: League;
  countryOptions: { value: Id; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const repos = useRepos();
  const [run, action] = useAction();
  const { draft, set } = useDraft<LeagueInput>({
    name: league.name,
    countryId: league.countryId,
    order: league.order,
    isActive: league.isActive,
  });

  const submit = async () => {
    if (!draft.name.trim()) return;
    const ok = await run(() => repos.matches.leagues.update(league.id, draft));
    if (ok) onSaved();
  };

  return (
    <Modal
      title="تعديل الدوري"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={() => void submit()} disabled={action.pending}>
            {action.pending ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={action.pending}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="grid grid-form">
        <Field label="اسم الدوري">
          <TextInput value={draft.name} onChange={(next) => set('name', next)} />
        </Field>
        <Field label="الدولة">
          <Select<Id>
            value={draft.countryId}
            onChange={(next) => set('countryId', next)}
            options={countryOptions}
          />
        </Field>
        <Field label="الترتيب" hint="الأصغر يظهر أول بالتطبيق">
          <TextInput
            type="number"
            value={draft.order ?? 0}
            onChange={(next) => set('order', Number(next) || 0)}
          />
        </Field>
        <Field label="الظهور" hint="الدوري المخفي ما تظهر مبارياته أبداً">
          <Switch
            checked={draft.isActive ?? true}
            onChange={(next) => set('isActive', next)}
            label="يظهر بالتطبيق"
          />
        </Field>
      </div>
      {action.error ? <div className="field-error mt-3">{action.error}</div> : null}
    </Modal>
  );
}

function TeamsTab() {
  const repos = useRepos();
  const leagues = useAsync(() => repos.matches.leagues.all(), []);
  const leagueOptions = [...(leagues.data ?? [])]
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        a.name.localeCompare(b.name) ||
        (a.country?.name ?? '').localeCompare(b.country?.name ?? ''),
    )
    .map((row) => ({
      value: row.id,
      label: leagueLabel(row),
      group: row.isActive ? 'الدوريات الفعّالة بالتطبيق' : 'بقية الدوريات',
    }));

  const [leagueId, setLeagueId] = useState<Id>('');

  return (
    <CrudScreen<Team, TeamInput, { leagueId?: Id }>
      title="كل الفرق"
      subtitle="فرق كل الدوريات وشعاراتها، حتى الدوريات غير المضافة للتطبيق — مصدرها المزامنة"
      repo={repos.matches.teams}
      searchable
      readOnlyCreate
      filter={leagueId ? { leagueId } : undefined}
      filters={
        <Select<Id>
          value={leagueId}
          onChange={setLeagueId}
          options={[{ value: '', label: 'كل الفرق — كل الدوريات' }, ...leagueOptions]}
        />
      }
      editTitle="تعديل الفريق"
      rowKey={(row) => row.id}
      labelOf={(row) => row.name}
      columns={[
        {
          key: 'logo',
          header: '',
          width: 52,
          render: (row) =>
            row.logoUrl ? (
              <img className="team-logo" src={row.logoUrl} alt="" loading="lazy" />
            ) : (
              <span className="dim">—</span>
            ),
        },
        {
          key: 'name',
          header: 'الفريق',
          render: (row) => <span className="strong">{row.name}</span>,
        },
        {
          key: 'league',
          header: 'الدوري',
          render: (row) => row.league?.name ?? '—',
        },
        {
          key: 'external',
          header: 'معرّف المزوّد',
          numeric: true,
          render: (row) =>
            row.externalId === null ? (
              <Pill tone="warning">يدوي</Pill>
            ) : (
              <span className="num dim">{row.externalId}</span>
            ),
        },
      ]}
      blank={() => ({ name: '', leagueId: leagueId || leagueOptions[0]?.value || '', logo: '' })}
      toInput={(row) => ({
        name: row.name,
        leagueId: row.leagueId,
        logo: row.logoUrl ?? '',
      })}
      validate={(draft) => (!draft.name.trim() ? 'اسم الفريق مطلوب' : null)}
      form={(draft, set) => (
        <>
          <Field label="اسم الفريق">
            <TextInput value={draft.name} onChange={(next) => set('name', next)} />
          </Field>
          <Field label="الدوري">
            <Select<Id>
              value={draft.leagueId}
              onChange={(next) => set('leagueId', next)}
              options={leagueOptions}
            />
          </Field>
          <Field label="رابط الشعار" className="span-2">
            <TextInput
              type="url"
              value={draft.logo ?? ''}
              onChange={(next) => set('logo', next)}
              placeholder="https://…"
            />
          </Field>
        </>
      )}
    >
      <MirroredNotice what="الفرق" />
    </CrudScreen>
  );
}
