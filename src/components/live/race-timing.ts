/**
 * Canlı ekran animasyon süreleri tek yerde: panel, yayın bandı ve duvar aynı ritmi kullanır.
 * Sürücü değiştiğinde sıra: önce eski sürücünün bitişi (FINISH), sonra yenisinin kontağı.
 */
export const FINISH_MS = 4_400;
export const IGNITION_SWEEP_MS = 1_200;
export const NEW_DRIVER_TAG_MS = 8_000;
export const PERIMETER_MS = 3_300;
/** Yayın bandında kalma süresi; bitiş, panel bayrağından biraz kısa (sonraki tanıtım beklemesin). */
export const BANNER_HOLD_MS = { intro: 6_000, finish: 3_600 } as const;
