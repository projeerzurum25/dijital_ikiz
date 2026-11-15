---
name: {{yetenek-adi}}
description: {{Ne yapar ve ne zaman tetiklenir}}
arguments: ["$ARGUMAN_1","$ARGUMAN_2"]
triggers: ["{{tetikleyici}}"]
owner: {{departmanlar/.../personeller/...}}
status: draft
---
# {{yetenek-adi}}

{{Ne yapar ve ne zaman tetiklenir}}

## Argümanlar
| Argüman | Açıklama |
|---|---|
| `$ARGUMAN_1` | {{açıklama}} |
| `$ARGUMAN_2` | {{açıklama}} |

## Adımlar
1. {{Adım 1}}
2. scripts/ornek.mjs betiğini çalıştır
3. references/ içindeki şablonla çıktıyı biçimlendir

## Paket İçeriği
- scripts/: `ornek.mjs`
- references/: `README.md`
- assets/: `README.md`
