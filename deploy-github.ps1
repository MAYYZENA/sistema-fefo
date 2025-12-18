# Deploy para GitHub Pages - 100% GRATUITO
# Execute: .\deploy-github.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   DEPLOY GITHUB PAGES - GRATUITO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica se Git está instalado
try {
    git --version | Out-Null
} catch {
    Write-Host "Git nao encontrado!" -ForegroundColor Red
    Write-Host "Baixe em: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

# Verifica se já é um repositório Git
if (-not (Test-Path ".git")) {
    Write-Host "Inicializando repositorio Git..." -ForegroundColor Yellow
    git init
    git branch -M main
}

# Adiciona todos os arquivos
Write-Host "Adicionando arquivos..." -ForegroundColor Yellow
git add .

# Faz commit
$dataHora = Get-Date -Format "dd/MM/yyyy HH:mm"
git commit -m "Deploy automatico - $dataHora" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   PROXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Crie uma conta no GitHub (se nao tiver):" -ForegroundColor White
Write-Host "   https://github.com/signup" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Crie um novo repositorio:" -ForegroundColor White
Write-Host "   https://github.com/new" -ForegroundColor Cyan
Write-Host "   Nome: sistema-fefo" -ForegroundColor Gray
Write-Host "   Publico ou Privado: Publico" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Execute estes comandos:" -ForegroundColor White
Write-Host "   git remote add origin https://github.com/SEU_USUARIO/sistema-fefo.git" -ForegroundColor Gray
Write-Host "   git push -u origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Ative o GitHub Pages:" -ForegroundColor White
Write-Host "   Repositorio > Settings > Pages" -ForegroundColor Gray
Write-Host "   Source: Deploy from a branch" -ForegroundColor Gray
Write-Host "   Branch: main / (root)" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Seu site estara em:" -ForegroundColor White
Write-Host "   https://SEU_USUARIO.github.io/sistema-fefo" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Arquivos preparados para deploy!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
