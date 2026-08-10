#!/bin/bash
#
# Production veritabanı yedeği alır, doğrular ve eskileri temizler.
#
# Railway'in kendi Backups özelliği Pro plana kilitli olduğu için yedek
# buradan alınıyor. Elle de çalıştırılabilir, cron'a da bağlanabilir.
#
# KURULUM
#   1. Adresi ev dizinine, repo DIŞINA yaz (repoya asla girmemeli):
#
#        echo 'KEMBORN_DB_URL=postgresql://...' > ~/.kemborn-yedek.env
#        chmod 600 ~/.kemborn-yedek.env
#
#      Adres: Railway → Postgres → Variables → DATABASE_PUBLIC_URL
#      (DATABASE_URL değil — o sadece Railway'in kendi ağından erişilir.)
#
#   2. Çalıştır:
#        ./kemborn-server/scripts/yedek-al.sh
#
#   3. Her gün 03:00'te otomatik almak için (crontab -e):
#        0 3 * * * /Users/eminulguc/Desktop/Kemborn/kemborn-server/scripts/yedek-al.sh
#
# UYARI: Yedek dosyasında müşteri adı, telefonu ve adresi var (KVKK).
# Repoya koyma, e-postayla gönderme, paylaşımlı klasöre atma.

set -euo pipefail

AYAR_DOSYASI="$HOME/.kemborn-yedek.env"
YEDEK_DIZINI="$HOME/kemborn-yedekler"
KAYIT="$YEDEK_DIZINI/yedek.log"
SAKLANACAK_ADET=14

# Beklenen tablolar — db/schema.sql ile aynı olmalı. Yedekte bunlardan biri
# eksikse dump yarım kalmış demektir; sessizce geçmesin diye kontrol ediliyor.
BEKLENEN_TABLO_SAYISI=6

# cron'un PATH'i çok dar; Homebrew'un pg_dump'ı orada görünmez. Bu yüzden
# önce bilinen konumlar deneniyor.
for yol in /opt/homebrew/bin /usr/local/bin /usr/bin; do
  [ -x "$yol/pg_dump" ] && PATH="$yol:$PATH" && break
done

# Log dizini ilk yazımdan ÖNCE hazır olmalı; yoksa hata mesajının kendisi
# "böyle bir dosya yok" hatası üretiyor ve asıl sebep kayboluyor.
mkdir -p "$YEDEK_DIZINI"

yaz() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$KAYIT"
}

hata_ver() {
  yaz "HATA: $*"
  exit 1
}

command -v pg_dump >/dev/null || hata_ver "pg_dump bulunamadı. Kurulum: brew install libpq"

[ -f "$AYAR_DOSYASI" ] || hata_ver "$AYAR_DOSYASI yok. Betiğin başındaki KURULUM adımlarına bak."

# shellcheck source=/dev/null
set -a; source "$AYAR_DOSYASI"; set +a
[ -n "${KEMBORN_DB_URL:-}" ] || hata_ver "$AYAR_DOSYASI içinde KEMBORN_DB_URL tanımlı değil."

DOSYA="$YEDEK_DIZINI/kemborn-$(date +%Y-%m-%d-%H%M).dump"

yaz "Yedek alınıyor..."
# Önce geçici ada yazılıyor: yarıda kesilen bir dump, sağlam yedek gibi
# durup en gerekli günde elde patlamasın.
if ! pg_dump "$KEMBORN_DB_URL" -Fc -f "$DOSYA.gecici" 2>>"$KAYIT"; then
  rm -f "$DOSYA.gecici"
  hata_ver "pg_dump başarısız oldu. Ayrıntı için: $KAYIT"
fi

# Doğrulama: dosya açılabiliyor mu ve içinde beklenen tablolar var mı?
TABLO_SAYISI=$(pg_restore -l "$DOSYA.gecici" 2>/dev/null | grep -c "TABLE DATA" || true)

if [ "$TABLO_SAYISI" -lt "$BEKLENEN_TABLO_SAYISI" ]; then
  rm -f "$DOSYA.gecici"
  hata_ver "Yedek eksik: $TABLO_SAYISI tablo bulundu, en az $BEKLENEN_TABLO_SAYISI bekleniyordu."
fi

mv "$DOSYA.gecici" "$DOSYA"
chmod 600 "$DOSYA"

BOYUT=$(du -h "$DOSYA" | cut -f1)
yaz "Tamam: $(basename "$DOSYA") ($BOYUT, $TABLO_SAYISI tablo)"

# Eskileri temizle — disk sessizce dolmasın
SILINEN=0
while IFS= read -r eski; do
  rm -f "$eski"
  SILINEN=$((SILINEN + 1))
done < <(ls -1t "$YEDEK_DIZINI"/kemborn-*.dump 2>/dev/null | tail -n +$((SAKLANACAK_ADET + 1)))

[ "$SILINEN" -gt 0 ] && yaz "$SILINEN eski yedek silindi (son $SAKLANACAK_ADET tutuluyor)."

yaz "Toplam $(ls -1 "$YEDEK_DIZINI"/kemborn-*.dump 2>/dev/null | wc -l | tr -d ' ') yedek, $YEDEK_DIZINI"
