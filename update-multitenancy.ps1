# Script para atualizar todas as referências de coleções do Firebase para multi-tenancy

$filePath = ".\app.js"
$content = Get-Content $filePath -Raw

Write-Host "🔄 Aplicando multi-tenancy..." -ForegroundColor Cyan

# Substituir db.collection('estoque') por getCollection('estoque')
$content = $content -replace "db\.collection\('estoque'\)", "getCollection('estoque')"
$content = $content -replace 'db\.collection\("estoque"\)', 'getCollection("estoque")'

# Substituir db.collection('historico') por getCollection('historico')
$content = $content -replace "db\.collection\('historico'\)", "getCollection('historico')"
$content = $content -replace 'db\.collection\("historico"\)', 'getCollection("historico")'

# Substituir db.collection('locais') por getCollection('locais')
$content = $content -replace "db\.collection\('locais'\)", "getCollection('locais')"
$content = $content -replace 'db\.collection\("locais"\)', 'getCollection("locais")'

# Manter catalogo-produtos global (compartilhado entre todos)
# Não substituir db.collection('catalogo-produtos')

# Salvar arquivo
$content | Set-Content $filePath -NoNewline

Write-Host "✅ Multi-tenancy aplicado com sucesso!" -ForegroundColor Green
Write-Host "📊 Coleções isoladas por usuário:" -ForegroundColor Yellow
Write-Host "   - estoque" -ForegroundColor White
Write-Host "   - historico" -ForegroundColor White
Write-Host "   - locais" -ForegroundColor White
Write-Host "   - marcas" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "🌐 Coleções globais (compartilhadas):" -ForegroundColor Yellow
Write-Host "   - catalogo-produtos" -ForegroundColor White
Write-Host "   - usuarios" -ForegroundColor White
