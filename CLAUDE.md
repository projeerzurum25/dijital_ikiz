# DIJITAL-IKIZ-PLATFORMU v4.0 — Kök Anayasa

Detaylı Süper Admin kuralları için [`_CORE-INFRASTRUCTURE/CLAUDE.md`](_CORE-INFRASTRUCTURE/CLAUDE.md) dosyasına bakın.

## Hızlı Komutlar
- **7/24 Sanal Ofis & Komuta Merkezi Sunucusunu Başlat:**
  ```bash
  npm start
  # Tarayıcı: http://127.0.0.1:4400
  ```
- **Yeni Kurum (Tenant) Oluştur:**
  ```bash
  ./_CORE-INFRASTRUCTURE/tenant-provisioner.sh --name "abc-holding" --subdomain "abc.sistem.com"
  # Windows PowerShell:
  powershell -File _CORE-INFRASTRUCTURE/tenant-provisioner.ps1 -Name abc-holding -Subdomain abc.sistem.com
  ```
- **Sağlık, Skill Anatomisi ve Multi-Tenant İzolasyon Denetimi (`/doctor`):**
  ```bash
  npm run doctor
  ```
