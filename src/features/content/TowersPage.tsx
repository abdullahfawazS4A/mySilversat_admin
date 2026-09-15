/**
 * Transmitter towers.
 *
 * The app's dish-alignment screen points at the nearest tower, so the pair of
 * coordinates is the whole record — a tower with a wrong longitude sends every
 * subscriber in the province pointing at the horizon.
 *
 * Filtering by province is the normal way in: an operator fixing coverage
 * works one province at a time.
 */

import { useState } from 'react';
import { Select } from '@/components/ui';
import { Field, TextInput } from '@/components/ui';
import { useAsync } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import type { Id, Tower } from '@/types';
import type { TowerInput } from '@/data/repositories/types';
import { CrudScreen } from '../shared/CrudScreen';

export function TowersPage() {
  const repos = useRepos();
  const provinces = useAsync(() => repos.geo.provinces.all(), []);
  const options = (provinces.data ?? []).map((row) => ({ value: row.id, label: row.name }));

  const [provinceId, setProvinceId] = useState<Id>('');

  return (
    <CrudScreen<Tower, TowerInput, { provinceId?: Id }>
      title="الأبراج"
      subtitle="مواقع الأبراج اللي يعتمدها التطبيق بضبط الصحن"
      repo={repos.content.towers}
      searchable
      filter={provinceId ? { provinceId } : undefined}
      filters={
        <Select<Id>
          value={provinceId}
          onChange={setProvinceId}
          options={[{ value: '', label: 'كل المحافظات' }, ...options]}
        />
      }
      createLabel="إضافة برج"
      createTitle="إضافة برج"
      editTitle="تعديل البرج"
      rowKey={(row) => row.id}
      labelOf={(row) => row.name}
      columns={[
        {
          key: 'name',
          header: 'البرج',
          render: (row) => (
            <div className="col">
              <span className="strong">{row.name}</span>
              <span className="fs-small dim">{row.nameKu || '—'}</span>
            </div>
          ),
        },
        {
          key: 'province',
          header: 'المحافظة',
          render: (row) => row.province?.name ?? '—',
        },
        {
          key: 'coords',
          header: 'الإحداثيات',
          numeric: true,
          render: (row) => (
            <span className="num">
              {row.latitude}, {row.longitude}
            </span>
          ),
        },
        {
          key: 'map',
          header: '',
          width: 72,
          render: (row) => (
            <a
              className="fs-small"
              href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              خريطة
            </a>
          ),
        },
      ]}
      blank={() => ({
        name: '',
        nameKu: '',
        latitude: 0,
        longitude: 0,
        provinceId: provinceId || options[0]?.value || '',
      })}
      toInput={(row) => ({
        name: row.name,
        nameKu: row.nameKu,
        latitude: row.latitude,
        longitude: row.longitude,
        provinceId: row.provinceId,
      })}
      validate={(draft) =>
        !draft.name.trim()
          ? 'اسم البرج مطلوب'
          : !draft.provinceId
            ? 'اختر المحافظة'
            : !draft.latitude || !draft.longitude
              ? 'خط الطول وخط العرض مطلوبين'
              : null
      }
      form={(draft, set) => (
        <>
          <Field label="اسم البرج بالعربي">
            <TextInput value={draft.name} onChange={(next) => set('name', next)} />
          </Field>
          <Field label="اسم البرج بالكردي">
            <TextInput value={draft.nameKu} onChange={(next) => set('nameKu', next)} />
          </Field>
          <Field label="المحافظة">
            <Select<Id>
              value={draft.provinceId}
              onChange={(next) => set('provinceId', next)}
              options={options}
            />
          </Field>
          <Field label="خط العرض (latitude)">
            <TextInput
              type="number"
              step={0.000001}
              value={draft.latitude}
              onChange={(next) => set('latitude', Number(next) || 0)}
              placeholder="36.3350"
            />
          </Field>
          <Field label="خط الطول (longitude)">
            <TextInput
              type="number"
              step={0.000001}
              value={draft.longitude}
              onChange={(next) => set('longitude', Number(next) || 0)}
              placeholder="43.1189"
            />
          </Field>
        </>
      )}
    />
  );
}
