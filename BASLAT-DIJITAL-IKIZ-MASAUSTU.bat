@echo off
chcp 65001 >nul
title Kurumsal Dijital Ikiz Platformu v4.0 - %100 Offline Masaustu Baslatici
cd /d "%~dp0"
echo ===============================================================================
echo   KURUMSAL DIJITAL IKIZ PLATFORMU v4.0 (%100 OFFLINE YEREL MOTOR)
echo   - Ankara Buyuksehir Belediyesi Bilgi Islem Dairesi Baskanligi (5 Sube Mudurlugu)
echo   - Akilli Sehirler Sube Mudurlugu / Proje Yonetimi Ekibi / Baskent Kart 3 Yillik Kabul Denetimi
echo ===============================================================================
start "" "http://127.0.0.1:4400"
node --no-warnings engine/src/server.mjs
pause
