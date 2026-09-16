/**
 * The product form, in one place.
 *
 * Only one name is typed here. The API keeps an internal `name` beside the
 * displayed one, but nothing in the console ever showed it — it only fed the
 * search haystack — so asking an operator for a second name was a field that
 * could only be got wrong. It is now mirrored from the displayed name, which
 * keeps the column populated and keeps search matching what people see.
 *
 * What is left are the **two bindings**: the province the product is sold in,
 * and the SilverSat server that turns its cards into live subscriptions. Those
 * two are what make a code provincial and what make a renewal reach the right
 * box, so a second copy of this form that forgets to validate the server
 * binding is a product whose cards silently never activate.
 *
 * The one rule encoded here: a product activating through SilverSat **must**
 * name a server. The API will accept a null one; the console will not, because
 * the failure only shows up later, on a customer's receiver.
 */

import { Field, Select, TextInput } from '@/components/ui';
import { ACTIVATION_API } from '@/lib/labels';
import type { ActivationApi, Id, Product } from '@/types';
import type { ProductInput } from '@/data/repositories/types';

/** A picker entry — the same shape for provinces and for servers. */
export interface Option {
  value: Id;
  label: string;
}

/** A new product, pre-bound to a province when the screen already knows one. */
export function blankProduct(provinceId: Id): ProductInput {
  return {
    name: '',
    displayName: '',
    provinceId,
    activationApi: 'silvers',
    silversatRegionId: null,
  };
}

/**
 * Turns a stored product back into an editable input.
 *
 * `image` is left out because the form no longer edits it. An update is a
 * PATCH, so a key that is not sent is a column that is not touched — the
 * product keeps whatever image it already had.
 */
export function productToInput(row: Product): ProductInput {
  return {
    name: row.name,
    displayName: row.displayName,
    provinceId: row.provinceId,
    activationApi: row.activationApi,
    silversatRegionId: row.silversatRegionId,
  };
}

/** What blocks a save. The displayed name and both bindings are required. */
export function validateProduct(draft: ProductInput): string | null {
  if (!draft.displayName.trim()) return 'اسم المنتج مطلوب';
  if (!draft.provinceId) return 'اختر المحافظة';
  if (draft.activationApi === 'silvers' && !draft.silversatRegionId) {
    return 'منتج التفعيل عبر سلفرسات لازم يرتبط بسيرفر';
  }
  return null;
}

type Setter = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => void;

/** Every field of a product: the displayed name and the two bindings. */
export function ProductFields({
  draft,
  set,
  provinceOptions,
  regionOptions,
}: {
  draft: ProductInput;
  set: Setter;
  provinceOptions: Option[];
  regionOptions: Option[];
}) {
  return (
    <>
      <Field label="اسم المنتج" className="span-2">
        <TextInput
          value={draft.displayName}
          onChange={(next) => {
            set('displayName', next);
            // The internal name is no longer typed, but the API still stores
            // one — mirror the displayed name so it is never blank.
            set('name', next);
          }}
          placeholder="سلفرسات نينوى"
        />
      </Field>

      <Field label="المحافظة">
        <Select<Id>
          value={draft.provinceId}
          onChange={(next) => set('provinceId', next)}
          options={provinceOptions}
        />
      </Field>
      <Field label="جهة التفعيل">
        <Select<ActivationApi>
          value={draft.activationApi ?? 'silvers'}
          onChange={(next) => {
            set('activationApi', next);
            // A non-silvers product has nothing to point a server at.
            if (next === 'other') set('silversatRegionId', null);
          }}
          options={(Object.keys(ACTIVATION_API) as ActivationApi[]).map((value) => ({
            value,
            label: ACTIVATION_API[value],
          }))}
        />
      </Field>

      <Field
        label="سيرفر سلفرسات (الـ API)"
        hint="نفس السيرفر اللي يروح إله التجديد والاستعلام لكل كارت من هذا المنتج"
        className="span-2"
      >
        <Select<Id>
          value={draft.silversatRegionId ?? ''}
          onChange={(next) => set('silversatRegionId', next || null)}
          options={[{ value: '', label: 'بدون سيرفر' }, ...regionOptions]}
          disabled={(draft.activationApi ?? 'silvers') !== 'silvers'}
        />
      </Field>
    </>
  );
}
