param([string]$Token = "nfp_MVDzaXQsnyPod5scbQfBpyj68wwYYE4La1f3")

$headers = @{ "Authorization" = "Bearer $Token" }

try {
    $sites = Invoke-RestMethod -Uri "https://api.netlify.com/api/v1/sites" -Headers $headers
    
    Write-Host "Total de sites: $($sites.Count)"
    Write-Host ""
    
    foreach ($site in $sites) {
        Write-Host "Nome: $($site.name)"
        Write-Host "ID: $($site.id)"
        Write-Host "URL: $($site.url)"
        Write-Host "---"
    }
} catch {
    Write-Host "Erro: $($_.Exception.Message)"
}
