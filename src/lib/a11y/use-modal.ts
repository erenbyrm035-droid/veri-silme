"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// Modal klavye davranışı — Esc, odak tuzağı, odak iadesi.
//
// NEDEN: kod tabanındaki modalların çoğu yalnızca "arka plana tıkla kapat"
// desenini kullanıyordu (`<div className="fixed inset-0" onClick={onClose}>`).
// Fareyle sorun yok; klavyeyle KAPANMIYORDU. Hesap silme onayı gibi bir
// pencerede kullanıcı kilitli kalıyordu — Esc çalışmıyor, arka plana da
// klavyeyle "tıklanamıyor".
//
// Üç şeyi birden yapar:
//   1. Esc ile kapatma
//   2. Odak tuzağı — Tab pencerenin dışına kaçmaz. Aksi halde kullanıcı
//      görünmez şekilde arkadaki sayfada gezinir.
//   3. Odak iadesi — kapanınca odak, pencereyi açan düğmeye döner. Yoksa odak
//      belgenin başına düşer ve kullanıcı yerini kaybeder.
//
// `BottomSheet.tsx`'teki mevcut Esc mantığı bu kancanın çekirdeğiyle aynı;
// yeni bir kalıp icat edilmedi, ortaklaştırıldı.
// ============================================================================

/** Odaklanabilir öğeler — `tabindex="-1"` olanlar hariç. */
const ODAKLANABILIR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModal<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void
) {
  const ref = useRef<T>(null);
  const oncekiOdak = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Açılışta odağı sakla; kapanışta buraya döneceğiz.
    oncekiOdak.current = document.activeElement as HTMLElement | null;

    // İlk odaklanabilir öğeye geç. Yoksa kabın kendisine (tabIndex={-1}).
    const kap = ref.current;
    const ilk = kap?.querySelector<HTMLElement>(ODAKLANABILIR);
    (ilk ?? kap)?.focus?.();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;

      const oge = Array.from(ref.current.querySelectorAll<HTMLElement>(ODAKLANABILIR)).filter(
        (el) => el.offsetParent !== null // gizli olanları atla
      );
      if (oge.length === 0) {
        e.preventDefault();
        return;
      }
      const ilkOge = oge[0];
      const sonOge = oge[oge.length - 1];

      // Uçlarda döngüye sok — odak pencerenin dışına çıkmasın.
      if (e.shiftKey && document.activeElement === ilkOge) {
        e.preventDefault();
        sonOge.focus();
      } else if (!e.shiftKey && document.activeElement === sonOge) {
        e.preventDefault();
        ilkOge.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const oncekiOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oncekiOverflow;
      oncekiOdak.current?.focus?.();
    };
  }, [open, onClose]);

  return ref;
}

/**
 * Modal kabına konacak ortak öznitelikler.
 *
 * `aria-modal` ve `role="dialog"` ekran okuyucuya "arka plan şu an geçersiz"
 * der; olmadan kullanıcı arkadaki içerikte kaybolur.
 */
export const modalProps = (baslikId?: string) =>
  ({
    role: "dialog" as const,
    "aria-modal": true,
    ...(baslikId ? { "aria-labelledby": baslikId } : {}),
    tabIndex: -1,
  });
