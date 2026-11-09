# AMG Pulse API

Nabız bileklikleri ve entegrasyonlar için sözleşme. Tüm yanıtlar JSON, hata gövdesi her zaman `{ "error": "<kod>", "details"?: ... }`.

## POST /api/ingest

Araçtaki nabız bilekliği ölçtüğü nabzı gönderir.

| Başlık | Değer |
| --- | --- |
| `X-Device-Key` | `INGEST_KEY` ortam değişkeni (tüm bilekliklerde aynı) |
| `Content-Type` | `application/json` |

Tek ölçüm:

```json
{ "deviceId": "band-01", "bpm": 112, "at": 1794212400000 }
```

Toplu (bağlantı koptuğunda biriken ölçümler, en fazla 500):

```json
{ "samples": [ { "deviceId": "band-01", "bpm": 112, "at": 1794212400000 }, { "deviceId": "band-01", "bpm": 114, "at": 1794212401000 } ] }
```

| Alan | Tür | Açıklama |
| --- | --- | --- |
| `deviceId` | string | Bileklik kimliği. N. araç için `band-0N` (`band-01` … `band-08`). |
| `plate` | string | `deviceId` yerine plaka da verilebilir (`34 AMG 001` ya da `34amg001`). |
| `bpm` | number | 30-230 arası. Dışındaki değerler sensör hatası sayılır, reddedilir. |
| `at` | number \| ISO string | Ölçüm zamanı (epoch ms). Yoksa ya da sunucu saatinden 5 dk'dan fazla saparsa sunucu saati kullanılır. |

Yanıt `202`:

```json
{ "accepted": 2, "logged": 2, "noSession": 0, "unknownVehicle": 0, "rejected": [] }
```

- `logged`: aktif sürüşe yazıldı.
- `noSession`: araçta sürücü atanmamış; canlı değer güncellendi, rapora yazılmadı.
- `unknownVehicle`: kimlik hiçbir araçla eşleşmedi.
- `rejected`: geçersiz öğeler, `index` ve alan hatalarıyla.

Hatalar: `401 unauthorized` (anahtar yanlış), `400 invalid_json | empty_batch`, `413 batch_too_large`.

Cihaz için öneri: her ölçümü kuyruğa ekleyin, 1 sn'de bir kuyruğun tamamını gönderin, yalnız `2xx` yanıtta kuyruktan
silin. `simulator/band.ts` bu davranışın başvuru uygulamasıdır.

```bash
curl -X POST https://<alan-adı>/api/ingest \
  -H "X-Device-Key: $INGEST_KEY" -H "Content-Type: application/json" \
  -d '{"deviceId":"band-01","bpm":118}'
```

## GET /api/stream

Canlı ekranın Server-Sent Events akışı. Her saniye bir `snapshot` olayı:

```json
{
  "generatedAt": 1794212400000,
  "stale": false,
  "settings": { "title": "Canlı Nabız Takibi", "subtitle": "…", "tagline": "TOO HARD TO RESIST", "gauge": "dial" },
  "vehicles": [
    {
      "id": "v1", "slot": 1, "plate": "34 AMG 001", "model": "AMG GT 63",
      "status": "live",
      "driver": { "firstName": "Deniz", "lastName": "Karaca" },
      "sessionStartedAt": 1794211200000,
      "bpm": 118, "sampleAt": 1794212399500,
      "stats": { "avg": 112, "min": 74, "max": 151 }
    }
  ]
}
```

`status`: `live` (taze veri) · `no-signal` (sürüş var, 15 sn veri yok) · `idle` (sürücü yok).
`stale: true`: veritabanına ulaşılamadı, son bilinen görüntü. Akış 280 sn'de kapanır, `retry: 1000` ile istemci yeniden bağlanır.

## GET /api/live

Aynı snapshot, tek seferlik JSON. `stale` ise `503`.

## GET /api/health

`{ "ok": true, "storage": "mongodb" | "memory", "vehicles": 8, "latencyMs": 42 }` ya da `503`.

## Admin

Yetki: tarayıcıda admin oturum çerezi ya da otomasyonda `X-Admin-Key: <ADMIN_PASSWORD>`. Etkileşimli doküman: `/docs` (Scalar).

| Uç nokta | Açıklama |
| --- | --- |
| `POST /api/admin/drivers` | Araca sürücü ata (önceki sürüş kapanır): `{ "vehicleId": "v6", "firstName": "Defne", "lastName": "Arıkan" }` |
| `POST /api/admin/sessions/end` | Sürüşü bitir: `{ "vehicleId": "v6" }` |
| `PUT /api/admin/settings` | Canlı ekran ayarları; verilmeyen alan korunur: `{ "title", "subtitle", "tagline", "gauge": "bar" \| "dial" }` |
| `GET /api/admin/export?kind=readings\|audit&cursor=` | Tüm loglar, 5.000'lik parçalar |

### Dosya indirme

| Uç nokta | Açıklama |
| --- | --- |
| `GET /api/admin/reports/csv` | Toplam rapor: plaka başına tüm sürüşler (`;` ayırıcılı, Excel uyumlu UTF-8). |
| `GET /api/admin/sessions/:id/csv` | Bir sürüşün saniye saniye ham nabız kaydı. |

Admin değişiklikleri (sürücü atama, ad düzeltme, araç, ekran ayarları) server action'larla yapılır: `src/app/admin/actions.ts`.
