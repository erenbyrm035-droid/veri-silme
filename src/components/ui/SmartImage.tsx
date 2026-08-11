"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// ============================================================================
// Optimize görsel sarmalayıcısı.
//
// NEDEN: `next.config.ts` içinde `remotePatterns` + AVIF/WebP ayarı vardı ama
// projede `next/image` HİÇ kullanılmıyordu — yani o konfigürasyon ölüydü ve
// mobil ağırlıklı bir üründe her görsel ham boyutuyla iniyordu.
//
// NEDEN DOĞRUDAN `next/image` DEĞİL: Optimizasyon yalnızca sunucunun
// çözümleyebildiği URL'ler için çalışır. Uygulamada üç kaynak var:
//   1. Supabase Storage (https)      → optimize edilebilir ✓
//   2. `blob:` / `data:` önizlemeler → optimize EDİLEMEZ (yükleme öncesi)
//   3. İmzalı/sorgu parametreli URL  → çalışır ama cache-bust parametresi
//                                       her seferinde yeni optimizasyon üretir
// Bu bileşen kaynağa bakıp doğru olanı seçer; çağıran taraf düşünmek zorunda
// kalmaz ve yanlış kullanımda sessizce bozulmaz.
// ============================================================================

/** Sunucu tarafı optimizasyonuna uygun mu? */
function isOptimizable(src: string): boolean {
  return !src.startsWith("blob:") && !src.startsWith("data:");
}

export interface SmartImageProps {
  src: string;
  alt: string;
  /** Sabit ölçü (avatar, küçük görsel). `fill` ile birlikte kullanılmaz. */
  width?: number;
  height?: number;
  /** Kapsayıcıyı doldur — kapsayıcı `relative` ve ölçülü olmalı. */
  fill?: boolean;
  className?: string;
  /** İlk ekranda görünen görseller için (LCP). Varsayılan: tembel yükleme. */
  priority?: boolean;
  sizes?: string;
  onError?: () => void;
  style?: React.CSSProperties;
  draggable?: boolean;
}

export function SmartImage({
  src, alt, width, height, fill, className, priority, sizes, onError, style, draggable,
}: SmartImageProps) {
  const [failed, setFailed] = React.useState(false);

  function handleError() {
    // Optimizasyon başarısız olursa (ör. yapılandırılmamış host) ham görsele düş.
    setFailed(true);
    onError?.();
  }

  if (!isOptimizable(src) || failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={draggable}
        className={cn(fill && "absolute inset-0 h-full w-full", className)}
        style={style}
        onError={onError}
      />
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "100vw"}
        priority={priority}
        draggable={draggable}
        className={className}
        style={style}
        onError={handleError}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 64}
      height={height ?? 64}
      sizes={sizes}
      priority={priority}
      draggable={draggable}
      className={className}
      style={style}
      onError={handleError}
    />
  );
}
