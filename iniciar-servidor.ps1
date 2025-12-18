# ========================================
#   SERVIDOR LOCAL - Sistema FEFO
# ========================================

Write-Host ""
Write-Host "Iniciando servidor em http://localhost:8080" -ForegroundColor Green
Write-Host ""
Write-Host "Pressione Ctrl+C para parar o servidor" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ir para o diretório do script
Set-Location $PSScriptRoot

# Iniciar servidor Python
python -m http.server 8080
