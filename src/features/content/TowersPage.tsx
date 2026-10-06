/**
 * Transmitter towers.
 *
 * The app's dish-alignment screen points at the nearest tower, so the pair of
 * coordinates is the whole record — a tower with a wrong longitude sends every
 * subscriber on that server pointing at the horizon.
 *
 * A tower belongs to a SilverSat server, not a province: the app lists the
 * towers of the subscriber's own server. Filtering by server is the normal way
 * in, since an operator fixing coverage works one server at a time. The rows
 * carry the server nested, so the name needs no lookup; a row that comes back
 * without one shows "—".
 */

import { useState } from 'react';
import { Select } from '@/components/ui';
import { Field, TextInput } from '@/components/ui';
import { useAsync } from '@/app/useAsync';
import { useRepos } from '@/app/RepositoryContext';
import type { Id, Tower } from '@/types';
import type { TowerInput } from '@/data/repositories/types';
import { CrudScreen } from '../shared/CrudScreen';
import { MapPicker } from './MapPicker';

export function TowersPage() {
  const repos = useRepos();
  const regions = useAsync(() => repos.regions.all(), []);
  const options = (regions.data ?? []).map((row) => ({ value: row.id, label: row.name }));

  const [regionId, setRegionId] = useState<Id>('');

  return (
    <CrudScreen<Tower, TowerInput, { silversatRegionId?: Id }>
      title="الأبراج"
      subtitle="مواقع الأبراج اللي يعتمدها التطبيق بضبط الصحن"
      repo={repos.content.towers}
      searchable
      filter={regionId ? { silversatRegionId: regionId } : undefined}
      filters={
        <Select<Id>
          value={regionId}
          onChange={setRegionId}
          options={[{ value: '', label: 'كل السيرفرات' }, ...options]}
        />
      }
      createLabel="إضافة برج"
      createTitle="إضافة برج"
      editTitle="تعديل البرج"
      dialogSize="lg"
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
          key: 'server',
          header: 'السيرفر',
          render: (row) => row.silversatRegion?.name ?? '—',
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
        silversatRegionId: regionId || options[0]?.value || '',
      })}
      toInput={(row) => ({
        name: row.name,
        nameKu: row.nameKu,
        latitude: row.latitude,
        longitude: row.longitude,
        silversatRegionId: row.silversatRegionId ?? '',
      })}
      validate={(draft) =>
        !draft.name.trim()
          ? 'اسم البرج مطلوب'
          : !draft.silversatRegionId
            ? 'اختر السيرفر'
            : !draft.latitude || !draft.longitude
              ? 'خط الطول وخط العرض مطلوبين'
              : Math.abs(draft.latitude) > 90 || Math.abs(draft.longitude) > 180
                ? 'الإحداثيات خارج المدى — العرض بين ‎-90 و 90 والطول بين ‎-180 و 180'
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
          <Field label="السيرفر">
            <Select<Id>
              value={draft.silversatRegionId}
              onChange={(next) => set('silversatRegionId', next)}
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
          <Field
            label="الموقع على الخريطة"
            hint="اضغط على الخريطة أو اسحب الدبوس، والإحداثيات تنملي وحدها"
            className="span-2"
          >
            <MapPicker
              latitude={draft.latitude}
              longitude={draft.longitude}
              onPick={(latitude, longitude) => {
                set('latitude', latitude);
                set('longitude', longitude);
              }}
            />
          </Field>
        </>
      )}
    />
  );
}
