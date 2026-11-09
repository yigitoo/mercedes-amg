# VPS kurulumu

Canlı ekran WebSocket (`/api/ws`) kullandığı için uygulama sürekli çalışan bir Node sürecinde koşar. Bu klasör tek
sunuculuk kurulumdur: **uygulama** (Next.js + `server.mts`) ve önünde **Caddy** (otomatik HTTPS, WebSocket geçişi).

## Gerekenler

- Docker Engine + Compose eklentisi olan bir Linux sunucu (1 vCPU / 1 GB RAM yeterli; imaj derlemesi için 2 GB önerilir).
- Alan adı: DNS'te bir `A` kaydı (ör. `pulse.example.com`) sunucunun IP'sini göstermeli.
- Güvenlik duvarında 80 ve 443 açık (Caddy sertifikayı 80 üzerinden alır).
- MongoDB (Atlas önerilir). Atlas'ta **Network Access**'e sunucunun IP'sini ekleyin.

## İlk kurulum

```bash
git clone https://github.com/yigitoo/mercedes-amg.git && cd mercedes-amg/deploy
cp .env.example .env
$EDITOR .env                      # DOMAIN, MONGODB_URI, ADMIN_PASSWORD, INGEST_KEY
docker compose up -d --build
docker compose ps                 # app: healthy, caddy: Up
curl https://<alan-adı>/api/health   # {"ok":true,"storage":"mongodb",...}
```

`INGEST_KEY` üretmek için: `openssl rand -hex 24`.

## Güncelleme

```bash
cd mercedes-amg && git pull && cd deploy && docker compose up -d --build
```

Yeniden başlatma birkaç saniye sürer; açık ekranlar WebSocket koptuğunda 1-5 sn aralıkla kendiliğinden yeniden bağlanır.

## İşletim

| Ne | Komut |
| --- | --- |
| Loglar | `docker compose logs -f app` |
| Durum | `docker compose ps` (app sağlık kontrolü `/api/health`) |
| Yeniden başlat | `docker compose restart app` |
| Durdur | `docker compose down` |

TV ekranı: `./mercedesctl desktop https://<alan-adı>` (geliştirme bilgisayarından) ya da tarayıcıda alan adı.
Bilekliklere: `https://<alan-adı>/api/ingest` + `INGEST_KEY`.

## Notlar

- Caddy'nin sertifikaları `caddy_data` biriminde tutulur; `docker compose down -v` bunları siler (yeniden alınır,
  Let's Encrypt sınırlarına dikkat).
- Önde başka bir ters vekil (nginx, Cloudflare) varsa WebSocket upgrade başlıklarını (`Upgrade`, `Connection`)
  iletmesi gerekir. Cloudflare proxy'si WebSocket'i varsayılan olarak destekler.
- Uygulama tek süreçtir; birden fazla kopya çalıştırmak gerekmez (her kopya kendi 1 Hz yayınını yapardı).
