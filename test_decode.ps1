$cp1252 = [System.Text.Encoding]::GetEncoding("windows-1252")
$utf8 = [System.Text.Encoding]::UTF8

$testStr = "Exportar RelatÃ³rio & AnÃ¡lise estratÃ©gica de vendas"
$bytes = $cp1252.GetBytes($testStr)
$recovered = $utf8.GetString($bytes)
Write-Output "Recovered: $recovered"
