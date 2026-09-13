/**
 * Leagues and teams.
 *
 * Both are mirrored from API-Football and neither is authored here, so the
 * create button is hidden: a row added by hand would carry no `externalId` and
 * the next sync would create the provider's own copy beside it. Editing is
 * still allowed, but only the columns the console owns are worth touching —
 * a league's display order and whether the app shows it at all.
 *
 * The sync itself lives on the API screen; this is where its result is read.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Field, Notice, Pill, Select, Switch, TextInput } from '@/components/ui';
import { useAsync } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import type { Id, League, Team } from '@/types';
import type { LeagueInput, TeamInput } from '@/data/repositories/types';
import { Tabs } from '@/components/ui';
import { CrudScreen } from '../shared/CrudScreen';

export function LeaguesPage() {
  const [tab, setTab] = useState<'leagues' | 'teams'>('leagues');

  return (
    <>
      <div className="page-wash" style={{ paddingBottom: 0 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'leagues', label: 'الدوريات' },
            { value: 'teams', label: 'الفرق' },
          ]}
        />
      </div>
      {tab === 'leagues' ? <LeaguesTab /> : <TeamsTab />}
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

function LeaguesTab() {
  const repos = useRepos();
  const countries = useAsync(() => repos.geo.countries.all(), []);
  const countryOptions = (countries.data ?? []).map((row) => ({ value: row.id, label: row.name }));

  const [countryId, setCountryId] = useState<Id>('');

  return (
    <CrudScreen<League, LeagueInput, { countryId?: Id }>
      title="الدوريات"
      subtitle="ترتيب الدوريات بالتطبيق وتفعيلها — مصدرها المزامنة"
      repo={repos.matches.leagues}
      searchable
      readOnlyCreate
      filter={countryId ? { countryId } : undefined}
      filters={
        <Select<Id>
          value={countryId}
          onChange={setCountryId}
          options={[{ value: '', label: 'كل الدول' }, ...countryOptions]}
        />
      }
      editTitle="تعديل الدوري"
      rowKey={(row) => row.id}
      labelOf={(row) => row.name}
      columns={[
        {
          key: 'order',
          header: 'الترتيب',
          numeric: true,
          width: 80,
          render: (row) => <span className="num">{row.order}</span>,
        },
        {
          key: 'name',
          header: 'الدوري',
          render: (row) => <span className="strong">{row.name}</span>,
        },
        {
          key: 'country',
          header: 'الدولة',
          render: (row) => row.country?.name ?? '—',
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
          key: 'active',
          header: 'الحالة',
          width: 96,
          render: (row) =>
            row.isActive ? <Pill tone="success">فعّال</Pill> : <Pill tone="muted">مخفي</Pill>,
        },
      ]}
      blank={() => ({ name: '', countryId: countryOptions[0]?.value ?? '', order: 0, isActive: true })}
      toInput={(row) => ({
        name: row.name,
        countryId: row.countryId,
        order: row.order,
        isActive: row.isActive,
      })}
      validate={(draft) => (!draft.name.trim() ? 'اسم الدوري مطلوب' : null)}
      form={(draft, set) => (
        <>
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
              label="فعّال بالتطبيق"
            />
          </Field>
        </>
      )}
    >
      <MirroredNotice what="الدوريات" />
    </CrudScreen>
  );
}

function TeamsTab() {
  const repos = useRepos();
  const leagues = useAsync(() => repos.matches.leagues.all(), []);
  const leagueOptions = (leagues.data ?? []).map((row) => ({ value: row.id, label: row.name }));

  const [leagueId, setLeagueId] = useState<Id>('');

  return (
    <CrudScreen<Team, TeamInput, { leagueId?: Id }>
      title="الفرق"
      subtitle="فرق كل دوري وشعاراتها — مصدرها المزامنة"
      repo={repos.matches.teams}
      searchable
      readOnlyCreate
      filter={leagueId ? { leagueId } : undefined}
      filters={
        <Select<Id>
          value={leagueId}
          onChange={setLeagueId}
          options={[{ value: '', label: 'كل الدوريات' }, ...leagueOptions]}
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
