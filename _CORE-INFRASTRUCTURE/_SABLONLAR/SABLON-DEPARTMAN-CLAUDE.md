# {{NO}}. {{DEPARTMAN_ADI}} — DEPARTMAN ANAYASASI

## Görev Alanı
{{anahtar-kavramlar}}

## Araçlar (öncelik: CLI > MCP > Plugin > Browser)
- {{CLI aracı}}

## Veri Erişimi (RBAC)
Bu departman yalnızca şu tablolara **salt-okunur** erişir: `{{tablo}}`

## Personel Yönlendirme Tablosu
| Personel | Klasör | Skills |
|---|---|---|
| {{Personel Unvanı}} ⭐ | `personeller/{{personel-adi}}/` | - |

## Kurallar
- Talep skill tetikleyicisiyle eşleşiyorsa ilgili personele, eşleşmiyorsa ⭐ departman yöneticisine yönlendir.
- Çıktılar `context/ciktilar/` altına tarihli kaydedilir.
- {{departman kuralı}}
