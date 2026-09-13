/**
 * Countries and provinces.
 *
 * Two tabs over one screen because they are one decision: a province cannot
 * exist without a country, and the operator who adds Ninawa has usually just
 * added Iraq. Splitting them into two routes would mean navigating between
 * them to finish one task.
 *
 * A province is the unit everything else is scoped by — products, app users,
 * towers and province-targeted ads all point at one.
 */

import { useState } from 'react';
import { Pill, Select } from '@/components/ui';
import { useAsync } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import type { Country, Id, Province } from '@/types';
import type { CountryInput, ProvinceInput } from '@/data/repositories/types';
import { Field, TextInput } from '@/components/ui';
import { Tabs } from '@/components/ui';
import { CrudScreen } from '../shared/CrudScreen';

export function ProvincesPage() {
  const [tab, setTab] = useState<'provinces' | 'countries'>('provinces');

  return (
    <>
      <div className="page-wash" style={{ paddingBottom: 0 }}>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'provinces', label: 'المحافظات' },
            { value: 'countries', label: 'الدول' },
          ]}
        />
      </div>
      {tab === 'provinces' ? <ProvincesTab /> : <CountriesTab />}
    </>
  );
}

function ProvincesTab() {
  const repos = useRepos();
  const countries = useAsync(() => repos.geo.countries.all(), []);
  const options = (countries.data ?? []).map((row) => ({ value: row.id, label: row.name }));

  return (
    <CrudScreen<Province, ProvinceInput>
      title="المحافظات"
      subtitle="وحدة التقسيم اللي ينبني عليها كل شي — المنتجات، المشتركون، الأبراج والإعلانات"
      repo={repos.geo.provinces}
      searchable
      createLabel="إضافة محافظة"
      createTitle="إضافة محافظة"
      editTitle="تعديل المحافظة"
      rowKey={(row) => row.id}
      labelOf={(row) => row.name}
      columns={[
        { key: 'name', header: 'المحافظة', render: (row) => <span className="strong">{row.name}</span> },
        { key: 'code', header: 'الرمز', render: (row) => <span className="num">{row.code}</span> },
        {
          key: 'country',
          header: 'الدولة',
          render: (row) => row.country?.name ?? '—',
        },
      ]}
      blank={() => ({ countryId: options[0]?.value ?? '', code: '', name: '' })}
      toInput={(row) => ({ countryId: row.countryId, code: row.code, name: row.name })}
      validate={(draft) =>
        !draft.name.trim() ? 'اسم المحافظة مطلوب' : !draft.countryId ? 'اختر الدولة' : null
      }
      form={(draft, set) => (
        <>
          <Field label="اسم المحافظة">
            <TextInput value={draft.name} onChange={(next) => set('name', next)} placeholder="نينوى" />
          </Field>
          <Field label="الرمز" hint="اختصار قصير يميّز المحافظة">
            <TextInput value={draft.code} onChange={(next) => set('code', next)} placeholder="Ne" />
          </Field>
          <Field label="الدولة">
            <Select<Id>
              value={draft.countryId}
              onChange={(next) => set('countryId', next)}
              options={options}
            />
          </Field>
        </>
      )}
    />
  );
}

function CountriesTab() {
  const repos = useRepos();

  return (
    <CrudScreen<Country, CountryInput>
      title="الدول"
      subtitle="الدول اللي تنتمي إلها المحافظات والدوريات"
      repo={repos.geo.countries}
      searchable
      createLabel="إضافة دولة"
      createTitle="إضافة دولة"
      editTitle="تعديل الدولة"
      rowKey={(row) => row.id}
      labelOf={(row) => row.name}
      columns={[
        { key: 'name', header: 'الدولة', render: (row) => <span className="strong">{row.name}</span> },
        { key: 'code', header: 'الرمز', render: (row) => <span className="num">{row.code}</span> },
        { key: 'dial', header: 'مفتاح الاتصال', render: (row) => <span className="num">{row.dialCode}</span> },
        { key: 'currency', header: 'العملة', render: (row) => <Pill tone="muted">{row.currency}</Pill> },
      ]}
      blank={() => ({ code: '', dialCode: '', name: '', currency: 'IQD' })}
      toInput={(row) => ({
        code: row.code,
        dialCode: row.dialCode,
        name: row.name,
        currency: row.currency,
      })}
      validate={(draft) => (!draft.name.trim() ? 'اسم الدولة مطلوب' : null)}
      form={(draft, set) => (
        <>
          <Field label="اسم الدولة">
            <TextInput value={draft.name} onChange={(next) => set('name', next)} placeholder="العراق" />
          </Field>
          <Field label="الرمز">
            <TextInput value={draft.code} onChange={(next) => set('code', next)} placeholder="iq" />
          </Field>
          <Field label="مفتاح الاتصال">
            <TextInput value={draft.dialCode} onChange={(next) => set('dialCode', next)} placeholder="+964" />
          </Field>
          <Field label="العملة">
            <TextInput value={draft.currency} onChange={(next) => set('currency', next)} placeholder="IQD" />
          </Field>
        </>
      )}
    />
  );
}
