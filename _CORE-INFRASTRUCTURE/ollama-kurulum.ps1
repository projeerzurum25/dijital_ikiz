# Ollama Offline Güvenlik Kilidi ve Model Kurulum Betiği
$ErrorActionPreference = "Stop"

Write-Host "1. OLLAMA_HOST=127.0.0.1:11434 (Sadece yerel loopback erişimi) ayarlanıyor..." -ForegroundColor Cyan
[Environment]::SetEnvironmentVariable("OLLAMA_HOST", "127.0.0.1:11434", "User")
$env:OLLAMA_HOST = "127.0.0.1:11434"

$ollamaExe = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
if (-not (Test-Path $ollamaExe)) {
  $cmd = Get-Command ollama -ErrorAction SilentlyContinue
  if ($cmd) { $ollamaExe = $cmd.Source }
}

if (-not (Test-Path $ollamaExe)) {
  Write-Host "Ollama henüz kurulumu tamamlamadı. Lütfen winget indirmesi bittikten sonra tekrar çalıştırın." -ForegroundColor Yellow
  exit 1
}

Write-Host "2. Ollama servisi kontrol ediliyor ($ollamaExe)..." -ForegroundColor Cyan
try {
  Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 3 | Out-Null
} catch {
  Start-Process -FilePath $ollamaExe -ArgumentList "serve" -WindowStyle Hidden
  Start-Sleep -Seconds 3
}

Write-Host "3. Yerel Türkçe / Kurumsal Dil Modeli (qwen2.5:3b) indiriliyor..." -ForegroundColor Cyan
& $ollamaExe pull qwen2.5:3b

Write-Host "4. Yerel Vektör / RAG Embedding Modeli (nomic-embed-text) indiriliyor..." -ForegroundColor Cyan
& $ollamaExe pull nomic-embed-text

Write-Host "✔ Ollama ve yerel modeller hazır! Artık internet bağlantısı olmadan %100 offline çalışabilirsiniz." -ForegroundColor Green
