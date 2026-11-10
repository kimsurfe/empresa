# Script de Verificacao de Integridade e Ortografia do Hub Comercial
# Execute sempre antes de concluir qualquer atualizacao!

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "INICIANDO AUDITORIA DE INTEGRIDADE E ORTOGRAFIA (HUB)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$hasError = $false

# 1. Checagem de BOM (UTF-8 sem BOM obrigatorio em todos os arquivos)
$filesToCheck = @('empresa/index.html', 'empresa/indicators.js', 'empresa/style.css', 'empresa/app.js', 'empresa/dashboard.js', 'empresa/extrato-pedidos-data.js', 'empresa/billing-data.js', 'empresa/clients-data.js')
foreach ($f in $filesToCheck) {
    if (Test-Path $f) {
        $bytes = [System.IO.File]::ReadAllBytes($f)
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
            Write-Host "[ERRO BOM] $f possui BOM UTF-8! Remova o BOM imediatamente." -ForegroundColor Red
            $hasError = $true
        } else {
            Write-Host "[OK BOM] $f (UTF-8 sem BOM)" -ForegroundColor Green
        }
    }
}

# 2. Checagem de Caractere de Substituicao (\uFFFD)
foreach ($f in $filesToCheck) {
    if (Test-Path $f) {
        $text = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
        if ($text.Contains([char]0xFFFD)) {
            Write-Host "[ERRO FFFD] $f contem caractere corrompido de substituicao (0xFFFD)!" -ForegroundColor Red
            $hasError = $true
        } else {
            Write-Host "[OK FFFD] $f sem caractere 0xFFFD" -ForegroundColor Green
        }
    }
}

# 3. Checagem Rigorosa de Ortografia e Acentuacao (Anti-Mojibake: prevencao de 'Todas as Referencias corrompidas')
$mojibakeSequences = @(
    @{ Name = 'e circunflexo corrompido'; Seq = [string][char]0x00C3 + [string][char]0x00AA },
    @{ Name = 'o til corrompido';         Seq = [string][char]0x00C3 + [string][char]0x00B5 },
    @{ Name = 'c cedilha corrompido';     Seq = [string][char]0x00C3 + [string][char]0x00A7 },
    @{ Name = 'a agudo corrompido';       Seq = [string][char]0x00C3 + [string][char]0x00A1 },
    @{ Name = 'e agudo corrompido';       Seq = [string][char]0x00C3 + [string][char]0x00A9 },
    @{ Name = 'i agudo corrompido';       Seq = [string][char]0x00C3 + [string][char]0x00AD },
    @{ Name = 'o agudo corrompido';       Seq = [string][char]0x00C3 + [string][char]0x00B3 },
    @{ Name = 'u agudo corrompido';       Seq = [string][char]0x00C3 + [string][char]0x00BA },
    @{ Name = 'a til corrompido';         Seq = [string][char]0x00C3 + [string][char]0x00A3 },
    @{ Name = 'a circunflexo corrompido'; Seq = [string][char]0x00C3 + [string][char]0x00A2 },
    @{ Name = 'A agudo corrompido';       Seq = [string][char]0x00C3 + [string][char]0x0081 },
    @{ Name = 'E agudo corrompido';       Seq = [string][char]0x00C3 + [string][char]0x0089 },
    @{ Name = 'I agudo corrompido';       Seq = [string][char]0x00C3 + [string][char]0x008D },
    @{ Name = 'O agudo corrompido';       Seq = [string][char]0x00C3 + [string][char]0x0093 },
    @{ Name = 'U agudo corrompido';       Seq = [string][char]0x00C3 + [string][char]0x009A },
    @{ Name = 'C cedilha corrompido';     Seq = [string][char]0x00C3 + [string][char]0x0087 },
    @{ Name = 'ordinal masc corrompido';  Seq = [string][char]0x00C2 + [string][char]0x00BA },
    @{ Name = 'ordinal fem corrompido';   Seq = [string][char]0x00C2 + [string][char]0x00AA },
    @{ Name = 'bullet corrompido';        Seq = [string][char]0x00E2 + [string][char]0x20AC + [string][char]0x00A2 },
    @{ Name = 'em-dash corrompido';       Seq = [string][char]0x00E2 + [string][char]0x20AC + [string][char]0x201D },
    @{ Name = 'en-dash corrompido';       Seq = [string][char]0x00E2 + [string][char]0x20AC + [string][char]0x2013 }
)

foreach ($f in $filesToCheck) {
    if (Test-Path $f) {
        $lines = [System.IO.File]::ReadAllLines($f, [System.Text.Encoding]::UTF8)
        $fileMojibakeFound = $false
        for ($i = 0; $i -lt $lines.Length; $i++) {
            $line = $lines[$i]
            foreach ($m in $mojibakeSequences) {
                if ($line.Contains($m.Seq)) {
                    Write-Host "[ERRO ORTOGRAFIA] $f linha $($i+1): $($m.Name) detectado! -> $($line.Trim())" -ForegroundColor Red
                    $hasError = $true
                    $fileMojibakeFound = $true
                    break
                }
            }
        }
        if (!$fileMojibakeFound) {
            Write-Host "[OK ORTOGRAFIA] $f (acentuacao e caracteres 100% corretos)" -ForegroundColor Green
        }
    }
}

# 4. Checagem de Sintaxe JavaScript (Balanceamento de chaves, parenteses e colchetes)
$jsFiles = @('empresa/indicators.js', 'empresa/app.js', 'empresa/dashboard.js')
foreach ($f in $jsFiles) {
    if (Test-Path $f) {
        $text = [System.IO.File]::ReadAllText($f, [System.Text.Encoding]::UTF8)
        $oB = [regex]::Matches($text, '\{').Count; $cB = [regex]::Matches($text, '\}').Count
        $oP = [regex]::Matches($text, '\(').Count; $cP = [regex]::Matches($text, '\)').Count
        $oK = [regex]::Matches($text, '\[').Count; $cK = [regex]::Matches($text, '\]').Count
        
        $diffB = $oB - $cB
        $diffP = $oP - $cP
        $diffK = $oK - $cK
        
        if ($diffB -ne 0 -or $diffP -ne 0 -or $diffK -ne 0) {
            Write-Host "[ERRO SINTAXE] $f possui desbalanceamento: Chaves=$diffB, Parenteses=$diffP, Colchetes=$diffK" -ForegroundColor Red
            $hasError = $true
        } else {
            Write-Host "[OK SINTAXE] $f balanceado (Chaves: $oB, Parenteses: $oP, Colchetes: $oK)" -ForegroundColor Green
        }
    }
}

# 5. Checagem Critica de Tags HTML Nao Aspadas em Atribuicoes JS (Prevencao do bug Unexpected token '<')
foreach ($f in $jsFiles) {
    if (Test-Path $f) {
        $lines = [System.IO.File]::ReadAllLines($f, [System.Text.Encoding]::UTF8)
        for ($i = 0; $i -lt $lines.Length; $i++) {
            $line = $lines[$i]
            if ($line -match '\.(innerHTML|outerHTML)\s*=\s*<[a-zA-Z]') {
                Write-Host "[ERRO CRITICO] $f linha $($i+1): Atribuicao de HTML sem aspas detectada! -> $line" -ForegroundColor Red
                $hasError = $true
            }
        }
    }
}

# 6. Checagem de Exportacao de Funcoes Globais no indicators.js
$indText = [System.IO.File]::ReadAllText('empresa/indicators.js', [System.Text.Encoding]::UTF8)
$requiredExports = @('initIndicatorsModule', 'renderIndicatorsView', 'toggleIndCMS', 'filterIndCMSOptions', 'indCMSSelectAll', 'onIndCMSCheckboxChange', 'applyIndicatorsFilter', 'clearIndicatorsFilter')
foreach ($fn in $requiredExports) {
    if (!($indText -match "window\.$fn\s*=")) {
        Write-Host "[ERRO EXPORT] Funcao window.$fn nao foi exportada em indicators.js!" -ForegroundColor Red
        $hasError = $true
    }
}

Write-Host "=====================================================" -ForegroundColor Cyan
if ($hasError) {
    Write-Host "FALHA: FORAM ENCONTRADOS ERROS NA AUDITORIA!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "SUCESSO: TODOS OS TESTES PASSARAM COM 100% DE INTEGRALIDADE E ORTOGRAFIA!" -ForegroundColor Green
    exit 0
}
