"use client";

import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";

// Örnek bildirimler (placeholder — gerçek veri sonraki sprintte).
const SAMPLE = [
  { title: "Yeni kullanıcı kaydı", body: "Bugün 24 yeni kullanıcı katıldı.", time: "5 dk" },
  { title: "GIF yüklemesi tamamlandı", body: "150 egzersiz GIF'i eklendi.", time: "1 sa" },
  { title: "Haftalık rapor hazır", body: "Beslenme raporları oluşturuldu.", time: "3 sa" },
];

export function NotificationButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative grid h-9 w-9 place-items-center rounded-full text-fg-muted outline-none transition-colors hover:bg-fg/5 hover:text-fg focus-visible:ring-2 focus-visible:ring-brand/40">
        <Bell size={18} />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand ring-2 ring-ink" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="text-sm font-semibold text-fg">Bildirimler</span>
          <span className="text-xs font-normal text-brand">{SAMPLE.length} yeni</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {SAMPLE.map((n) => (
            <div
              key={n.title}
              className="flex gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-fg/5"
            >
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="truncate text-xs text-fg-muted">{n.body}</p>
                <p className="mt-0.5 text-[11px] text-fg-muted/70">{n.time} önce</p>
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
