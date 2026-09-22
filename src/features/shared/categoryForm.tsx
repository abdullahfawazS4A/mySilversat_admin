/**
 * The category form, in one place.
 *
 * A category is edited from two directions — the flat price list, and the
 * product it belongs to — so the fields, the blank draft and the validation
 * live here and both screens render the same thing.
 *
 * `productId` is deliberately not a field: the flat list picks the product in
 * its own dialog, and the product screen already knows it. Putting a product
 * picker inside the shared body would mean the product screen renders a
 * control that can only be set to one value.
 *
 * The form is six fields, and the three the API still accepts but nobody fills
 * in — `hasSecondaryCode`, `isDisabled`, `sortOrder` — are left off it rather
 * than sent as defaults. They stay on `Category` because the tables read them;
 * they are simply not the console's to set any more. A category that needs one
 * of them is a category that needs this form to grow a control again.
 */

import { Field, Switch, TextInput } from '@/components/ui';
import type { CategoryInput } from '@/data/repositories/types';
import { toAmount, type Category, type Id } from '@/types';

/** A new, empty price tier under one product. */
export function blankCategory(productId: Id): CategoryInput {
  return {
    productId,
    name: '',
    nameKu: '',
    costPrice: 0,
    unitPrice: 0,
    lowStockThreshold: null,
    isDisplay: true,
  };
}

/** Turns a stored category back into an editable input. */
export function categoryToInput(row: Category): CategoryInput {
  return {
    productId: row.productId,
    name: row.name,
    nameKu: row.nameKu,
    costPrice: toAmount(row.costPrice),
    unitPrice: toAmount(row.unitPrice),
    lowStockThreshold: row.lowStockThreshold,
    isDisplay: row.isDisplay,
  };
}

/**
 * What blocks a save.
 *
 * Every rule here is one the API enforces too — the point is which sentence
 * the operator reads. A missing Kurdish name comes back as a validation list
 * naming `nameKu`, and a cost above the app price comes back as a constraint
 * message; neither says which box on the screen to go fix.
 *
 * Cost may legitimately be zero — a promotional batch costs us nothing — but
 * the app price may not: a tier priced at zero is not a tier that sells for
 * nothing, it is a tier nobody set a price for.
 */
export function validateCategory(draft: CategoryInput): string | null {
  if (!draft.productId) return 'اختر المنتج';
  if (!draft.name.trim()) return 'اسم الفئة بالعربي مطلوب';
  if (!draft.nameKu.trim()) return 'اسم الفئة بالكردي مطلوب';
  if (draft.unitPrice <= 0) return 'سعر التطبيق لازم يكون أكبر من صفر';
  if (draft.costPrice < 0) return 'سعر الكلفة ما يصير بالسالب';
  if (draft.costPrice > draft.unitPrice) return 'سعر الكلفة ما يصير أكبر من سعر التطبيق';
  return null;
}

type Setter = <K extends keyof CategoryInput>(key: K, value: CategoryInput[K]) => void;

/** Every field of a category except the product it hangs off. */
export function CategoryFields({ draft, set }: { draft: CategoryInput; set: Setter }) {
  return (
    <>
      <Field label="اسم الفئة بالعربي">
        <TextInput
          value={draft.name}
          onChange={(next) => set('name', next)}
          placeholder="اشتراك 12 شهر"
        />
      </Field>
      <Field label="اسم الفئة بالكردي">
        <TextInput value={draft.nameKu} onChange={(next) => set('nameKu', next)} />
      </Field>

      <Field label="سعر الكلفة" hint="شكد يكلّفنا الكارت — ما يصير أكبر من سعر التطبيق">
        <TextInput
          type="number"
          min={0}
          value={draft.costPrice}
          onChange={(next) => set('costPrice', Number(next) || 0)}
        />
      </Field>
      <Field label="سعر التطبيق" hint="السعر اللي يشوفه المشترك">
        <TextInput
          type="number"
          min={0}
          value={draft.unitPrice}
          onChange={(next) => set('unitPrice', Number(next) || 0)}
        />
      </Field>

      <Field label="حد التنبيه للمخزون" hint="خلّيها فارغة حتى تطفي التنبيه">
        <TextInput
          type="number"
          min={0}
          value={draft.lowStockThreshold ?? ''}
          onChange={(next) => set('lowStockThreshold', next === '' ? null : Number(next) || 0)}
        />
      </Field>
      <Field label="العرض بالتطبيق">
        <Switch
          checked={draft.isDisplay ?? true}
          onChange={(next) => set('isDisplay', next)}
          label="تنعرض بالتطبيق"
        />
      </Field>
    </>
  );
}
