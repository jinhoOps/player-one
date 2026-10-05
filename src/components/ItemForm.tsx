"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  SHELF_SIZE,
  STATUS_LABELS,
  VERDICT_LABELS,
  type CategoryKey,
  type Item,
  type ItemInput,
  type ItemStatus,
  type Verdict,
} from "@/lib/items";
import { UnitInput } from "./EquipFields";
import { ItemIcon } from "./ItemIcon";
import s from "./ui.module.css";
import x from "./items.module.css";

/** Pick one of a few, tap again to clear (unless required). */
function Pick<K extends string>({
  name,
  label,
  options,
  value,
  onChange,
  required,
}: {
  name: string;
  label: string;
  options: Record<K, string>;
  value: K | null;
  onChange: (v: K | null) => void;
  required?: boolean;
}) {
  return (
    <span className={s.chips} role="group" aria-label={label}>
      <input type="hidden" name={name} value={value ?? ""} />
      {(Object.keys(options) as K[]).map((k) => (
        <button
          key={k}
          type="button"
          className={s.chip}
          aria-pressed={value === k}
          onClick={() => onChange(value === k && !required ? null : k)}
        >
          {options[k]}
        </button>
      ))}
    </span>
  );
}

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;
const num = (fd: FormData, k: string) => {
  const raw = String(fd.get(k) ?? "").trim();
  return raw === "" ? null : Number(raw);
};

/** Add or edit one item. Everything but the name is optional; fill the rest in later. */
export function ItemForm({
  item,
  initialCategory,
  customCategories,
  brands,
  shelfCount,
  onSave,
  onDelete,
  onClose,
}: {
  item?: Item;
  initialCategory?: CategoryKey;
  /** Labels the owner already made, offered for reuse. */
  customCategories: string[];
  brands: string[];
  /** Items on display right now, this one included if it is. */
  shelfCount: number;
  onSave: (input: ItemInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<CategoryKey>(item?.category ?? initialCategory ?? "digital");
  const [status, setStatus] = useState<ItemStatus | null>(item?.status ?? "using");
  const [verdict, setVerdict] = useState<Verdict | null>(item?.verdict ?? null);
  const [displayed, setDisplayed] = useState(item?.displayed ?? false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const shelfFull = !displayed && shelfCount - (item?.displayed ? 1 : 0) >= SHELF_SIZE;

  useEffect(() => nameInput.current?.focus({ preventScroll: true }), []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: ItemInput = {
      category,
      custom_category: category === "custom" ? (text(fd, "custom_category") ?? "기타") : null,
      name: text(fd, "name") ?? "",
      brand: text(fd, "brand"),
      model: text(fd, "model"),
      bought_on: text(fd, "bought_on"),
      price: num(fd, "price"),
      store_url: text(fd, "store_url"),
      qty: num(fd, "qty"),
      qty_target: num(fd, "qty_target"),
      status: status ?? "using",
      verdict,
      note: text(fd, "note"),
      displayed,
    };
    setBusy(true);
    setError(null);
    try {
      await onSave(input);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    setBusy(true);
    try {
      await onDelete?.();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit}>
      <div className={s.formRow}>
        <span className="label">분류</span>
        <div className={x.catPick} role="radiogroup" aria-label="분류">
          {[...CATEGORY_KEYS, "custom" as const].map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={category === k}
              className={x.catChoice}
              title={k === "custom" ? "직접 만든 분류 (나만 보기)" : CATEGORIES[k].hint}
              onClick={() => setCategory(k)}
            >
              <ItemIcon kind={k} size={20} />
              <span>{k === "custom" ? "직접" : CATEGORIES[k].label}</span>
            </button>
          ))}
        </div>
      </div>
      {category === "custom" ? (
        <label className={s.formRow}>
          <span className="label">분류 이름</span>
          <span className={x.withNote}>
            <input
              name="custom_category"
              list="custom-categories"
              maxLength={16}
              defaultValue={item?.custom_category ?? ""}
              placeholder="예: 자동차 용품"
            />
            <datalist id="custom-categories">
              {customCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <span className={x.privateNote}>나만 보기</span>
          </span>
        </label>
      ) : (
        <p className={s.formHint}>{CATEGORIES[category].hint}</p>
      )}

      <label className={s.formRow}>
        <span className="label">이름</span>
        <input ref={nameInput} name="name" required maxLength={48} defaultValue={item?.name ?? ""} placeholder="예: 인덕션 프라이팬+웍 세트" />
      </label>
      <label className={s.formRow}>
        <span className="label">브랜드</span>
        <input name="brand" list="item-brands" maxLength={32} defaultValue={item?.brand ?? ""} placeholder="예: 테팔" />
      </label>
      <datalist id="item-brands">
        {brands.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <label className={s.formRow}>
        <span className="label">모델명</span>
        <input name="model" maxLength={48} defaultValue={item?.model ?? ""} placeholder="품번까지 적으면 다시 사기 쉬워요" />
      </label>

      <div role="group" aria-label="구매" className={s.formGroup}>
        <label className={s.formRow}>
          <span className="label">구매일</span>
          <input name="bought_on" type="date" defaultValue={item?.bought_on ?? ""} />
        </label>
        <label className={s.formRow}>
          <span className="label">가격</span>
          <UnitInput name="price" label="가격" unit="원" step={100} min={0} placeholder="예: 89000" defaultValue={item?.price} />
        </label>
        <label className={s.formRow}>
          <span className="label">구매처</span>
          <span className={x.withNote}>
            <input name="store_url" type="url" inputMode="url" maxLength={500} defaultValue={item?.store_url ?? ""} placeholder="https://" />
            {item?.store_url && (
              <a className={x.storeLink} href={item.store_url} target="_blank" rel="noreferrer">
                열기
              </a>
            )}
          </span>
        </label>
        <div className={s.formRow}>
          <span className="label">수량</span>
          <span className={x.qtyPair}>
            <UnitInput name="qty" label="보유 수량" unit="보유" step={1} min={0} placeholder="0" defaultValue={item?.qty} />
            <span className={x.qtySlash}>/</span>
            <UnitInput name="qty_target" label="적정 수량" unit="적정" step={1} min={0} placeholder="0" defaultValue={item?.qty_target} />
          </span>
        </div>
        <p className={s.formHint}>수건·식기처럼 개수를 채워 두는 물건만 적어요. 모자라면 보충 표시가 떠요.</p>
      </div>

      <div role="group" aria-label="평가" className={s.formGroup}>
        <div className={s.formRow}>
          <span className="label">상태</span>
          <Pick name="status" label="상태" options={STATUS_LABELS} value={status} onChange={setStatus} required />
        </div>
        <div className={s.formRow}>
          <span className="label">다시 살까</span>
          <Pick name="verdict" label="다시 살까" options={VERDICT_LABELS} value={verdict} onChange={setVerdict} />
        </div>
        <label className={s.formRow}>
          <span className="label">한 줄 후기</span>
          <input name="note" maxLength={200} defaultValue={item?.note ?? ""} placeholder="예: 인덕션 OK, 웍이 생각보다 무거움" />
        </label>
      </div>

      <div className={s.formGroup}>
        <div className={s.formRow}>
          <span className="label">진열장</span>
          <span className={x.withNote}>
            <button
              type="button"
              className={x.shelfToggle}
              aria-pressed={displayed}
              disabled={shelfFull}
              onClick={() => setDisplayed(!displayed)}
            >
              <ItemIcon kind="trophy" size={16} />
              {displayed ? "진열 중" : "진열하기"}
            </button>
            <span className={x.privateNote}>
              {shelfFull ? `진열장이 가득 찼어요 (${SHELF_SIZE}칸)` : "공개 프로필엔 아이콘·이름·브랜드·구매 연도만"}
            </span>
          </span>
        </div>
      </div>

      {error && <p className={x.error}>{error}</p>}
      <div className={`${s.formActions} ${x.actions}`}>
        {onDelete && (
          <button type="button" className={`btn btn-soft ${x.delete}`} onClick={remove} disabled={busy}>
            {confirmDelete ? "정말 삭제" : "삭제"}
          </button>
        )}
        <button type="button" className="btn btn-soft" onClick={onClose} disabled={busy}>
          취소
        </button>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
