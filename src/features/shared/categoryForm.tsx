/**
 * The category form, in one place.
 *
 * A category is edited from two directions — the flat price list, and the
 * product it belongs to — and it carries eleven fields, four of them prices.
 * Two copies of that form is how one of them ends up missing `isDisplay`, or
 * validating `unitPrice` and not the other three. So the fields, the blank
 * draft and the validation live here and both screens render the same thing.
 *
 * `productId` is deliberately not a field: the flat list picks the product in
 * its own dialog, and the product screen already knows it. Putting a product
 * picker inside the shared body would mean the product screen renders a
 * control that can only be set to one value.
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
    mainPrice: 0,
    subPrice: 0,
    hasSecondaryCode: false,
    lowStockThreshold: null,
    isDisabled: false,
    isDisplay: true,
    sortOrder: 0,
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
    mainPrice: toAmount(row.mainPrice),
    subPrice: toAmount(row.subPrice),
    hasSecondaryCode: row.hasSecondaryCode,
    lowStockThreshold: row.lowStockThreshold,
    isDisabled: row.isDisabled,
    isDisplay: row.isDisplay,
    sortOrder: row.sortOrder,
  };
}

/**
 * What blocks a save.
 *
 * Cost may legitimately be zero — a promotional batch costs us nothing — but
 * the three selling prices may not, and the two reseller tiers are the reason
 * this check exists at all. The API rejects a zero `mainPrice` or `subPrice`
 * at the database layer and reports it as `Database query failed`, a sentence
 * that says nothing about which field is wrong. Since the blank draft starts
 * both at zero, filling in only the app price — the obvious way to add a
 * category — produced that error every time. Catching it here names the field
 * instead, and never sends the request.
 *
 * Read as intent rather than as a rule about money: a tier priced at zero is
 * not a tier that sells for nothing, it is a tier nobody set a price for.
 */
export function validateCategory(draft: CategoryInput): string | null {
  if (!draft.productId) return 'اختر المنتج';
  if (!draft.name.trim()) return 'اسم الفئة مطلوب';
  if (draft.unitPrice <= 0) return 'سعر التطبيق لازم يكون أكبر من صفر';
  if (draft.mainPrice <= 0) return 'سعر الوكيل الرئيسي لازم يكون أكبر من صفر';
  if (draft.subPrice <= 0) return 'سعر الوكيل الفرعي لازم يكون أكبر من صفر';
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

      <Field label="سعر الكلفة" hint="شكد يكلّفنا الكارت">
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
      <Field label="سعر الوكيل الرئيسي" hint="مطلوب — لازم يكون أكبر من صفر">
        <TextInput
          type="number"
          min={0}
          value={draft.mainPrice}
          onChange={(next) => set('mainPrice', Number(next) || 0)}
        />
      </Field>
      <Field label="سعر الوكيل الفرعي" hint="مطلوب — لازم يكون أكبر من صفر">
        <TextInput
          type="number"
          min={0}
          value={draft.subPrice}
          onChange={(next) => set('subPrice', Number(next) || 0)}
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
      <Field label="الترتيب">
        <TextInput
          type="number"
          value={draft.sortOrder ?? 0}
          onChange={(next) => set('sortOrder', Number(next) || 0)}
        />
      </Field>

      <Field label="كود ثانوي" hint="فعّلها إذا الكارت يجي بقيمتين">
        <Switch
          checked={draft.hasSecondaryCode ?? false}
          onChange={(next) => set('hasSecondaryCode', next)}
          label="الكارت يحمل قيمة ثانية"
        />
      </Field>
      <Field label="العرض بالتطبيق">
        <Switch
          checked={draft.isDisplay ?? true}
          onChange={(next) => set('isDisplay', next)}
          label="تنعرض بالتطبيق"
        />
      </Field>
      <Field label="التعطيل" hint="الفئة المعطّلة ما تنباع أبداً">
        <Switch
          checked={draft.isDisabled ?? false}
          onChange={(next) => set('isDisabled', next)}
          label="معطّلة"
        />
      </Field>
    </>
  );
}
