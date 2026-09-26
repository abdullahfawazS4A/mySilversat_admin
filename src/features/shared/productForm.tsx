/**
 * The product form, in one place.
 *
 * Only one name is typed here. The API keeps an internal `name` beside the
 * displayed one, but nothing in the console ever showed it — it only fed the
 * search haystack — so asking an operator for a second name was a field that
 * could only be got wrong. It is now mirrored from the displayed name, which
 * keeps the column populated and keeps search matching what people see.
 *
 * What is left is the **one binding**: the SilverSat server that turns the
 * product's cards into live subscriptions. The product has no province of its
 * own any more — it is in whatever province its server is in — so the server
 * is both where renewals go and whose stock this is. Moving a product to
 * another server moves its stock to that server's province with it.
 *
 * The API requires the server on every product, SilverSat-activated or not,
 * and refuses a `provinceId` outright.
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

/** A new product, pre-bound to a server when the screen already knows one. */
export function blankProduct(silversatRegionId: Id): ProductInput {
  return {
    name: '',
    displayName: '',
    silversatRegionId,
    activationApi: 'silvers',
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
    activationApi: row.activationApi,
    silversatRegionId: row.silversatRegionId,
  };
}

/** What blocks a save. The displayed name and the server are required. */
export function validateProduct(draft: ProductInput): string | null {
  if (!draft.displayName.trim()) return 'اسم المنتج مطلوب';
  if (!draft.silversatRegionId) return 'اختر سيرفر سلفرسات';
  return null;
}

type Setter = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => void;

/**
 * Every field of a product: the displayed name, the server and how it activates.
 *
 * `regionOptions` should carry the server's province in the label — it is the
 * only place the operator sees which province they are choosing.
 */
export function ProductFields({
  draft,
  set,
  regionOptions,
}: {
  draft: ProductInput;
  set: Setter;
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

      <Field
        label="سيرفر سلفرسات"
        hint="المحافظة تنحسب من السيرفر — ونفس السيرفر يروح إله التجديد والاستعلام لكارتات هذا المنتج"
      >
        <Select<Id>
          value={draft.silversatRegionId}
          onChange={(next) => set('silversatRegionId', next)}
          options={[{ value: '', label: 'اختر السيرفر' }, ...regionOptions]}
        />
      </Field>
      <Field label="جهة التفعيل">
        <Select<ActivationApi>
          value={draft.activationApi ?? 'silvers'}
          onChange={(next) => set('activationApi', next)}
          options={(Object.keys(ACTIVATION_API) as ActivationApi[]).map((value) => ({
            value,
            label: ACTIVATION_API[value],
          }))}
        />
      </Field>
    </>
  );
}
