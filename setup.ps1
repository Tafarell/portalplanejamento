# Portal BI - Setup Automatico (PowerShell)
# Execute: .\setup.ps1

$ErrorActionPreference = "Continue"
$PSScriptRoot2 = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-OK   { param($m); Write-Host "  [OK] $m" -ForegroundColor Green }
function Write-Fail { param($m); Write-Host "  [X]  $m" -ForegroundColor Red }
function Write-Info { param($m); Write-Host "  [>]  $m" -ForegroundColor Cyan }
function Write-Warn { param($m); Write-Host "  [!]  $m" -ForegroundColor Yellow }

function Write-Step {
    param($m)
    Write-Host ""
    Write-Host "-----------------------------------------------" -ForegroundColor Blue
    Write-Host "  $m" -ForegroundColor Blue
    Write-Host "-----------------------------------------------" -ForegroundColor Blue
}

function Ask-Input {
    param($prompt, $default = "")
    if ($default -ne "") {
        $r = Read-Host "  [?]  $prompt [$default]"
        if ($r -eq "") { return $default }
        return $r
    }
    return Read-Host "  [?]  $prompt"
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Blue
Write-Host "   Portal BI - Setup Automatico"               -ForegroundColor Blue
Write-Host "===============================================" -ForegroundColor Blue

# -------------------------------------------------------
# 1. Carregar ou criar .env
# -------------------------------------------------------
Write-Step "1/5  Credenciais Supabase"

$envPath = Join-Path $PSScriptRoot2 ".env"
$cfg = @{}

if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match "^([^#=]+)=(.*)$") {
            $cfg[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"')
        }
    }
    Write-OK ".env encontrado com $($cfg.Keys.Count) variaveis"
    $usar = Ask-Input "Usar credenciais existentes? (S/n)" "S"
    if ($usar -match "^[Nn]") {
        $cfg = @{}
    } else {
        Write-Info "Usando .env existente"
    }
}

if (-not $cfg["SUPABASE_URL"]) {
    Write-Host ""
    Write-Host "  Preencha com os dados do Supabase (Settings > API / Database):" -ForegroundColor Yellow
    Write-Host ""

    $cfg["SUPABASE_URL"]          = Ask-Input "SUPABASE_URL (ex: https://xxxx.supabase.co)"
    $cfg["SUPABASE_SERVICE_KEY"]  = Ask-Input "SUPABASE_SERVICE_KEY (service_role key)"
    $cfg["DATABASE_URL"]          = Ask-Input "DATABASE_URL (porta 6543 - Transaction mode)"
    $cfg["OPENAI_API_KEY"]        = Ask-Input "OPENAI_API_KEY (sk-proj-...)"
    $cfg["FRONTEND_URL"]          = Ask-Input "URL do frontend Railway (preencha depois)" "https://portal-bi-frontend.up.railway.app"

    # Gerar SECRET_KEY
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 32
    $rng.GetBytes($bytes)
    $cfg["SECRET_KEY"] = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""

    $cfg["OPENAI_MODEL"]             = "gpt-4o"
    $cfg["SUPABASE_BUCKET_COVERS"]   = "covers"
    $cfg["SUPABASE_BUCKET_PARQUET"]  = "parquet"

    # Salvar .env
    $linhas = @()
    foreach ($k in $cfg.Keys) {
        $linhas += "$k=`"$($cfg[$k])`""
    }
    [System.IO.File]::WriteAllLines($envPath, $linhas, [System.Text.Encoding]::UTF8)
    Write-OK ".env salvo"
}

$SUPA_URL = $cfg["SUPABASE_URL"].TrimEnd("/")
$SUPA_KEY = $cfg["SUPABASE_SERVICE_KEY"]
$DB_URL   = $cfg["DATABASE_URL"]

# -------------------------------------------------------
# 2. Criar buckets no Supabase Storage
# -------------------------------------------------------
Write-Step "2/5  Configurar Supabase Storage"

$headers = @{
    "Authorization" = "Bearer $SUPA_KEY"
    "Content-Type"  = "application/json"
    "apikey"        = $SUPA_KEY
}

function New-Bucket {
    param($nome, $publico)
    $body = "{`"id`":`"$nome`",`"name`":`"$nome`",`"public`":$($publico.ToString().ToLower())}"
    try {
        $null = Invoke-RestMethod -Uri "$SUPA_URL/storage/v1/bucket" -Method POST -Headers $headers -Body $body -ErrorAction Stop
        Write-OK "Bucket '$nome' criado (publico=$publico)"
    }
    catch {
        $errMsg = $_.ErrorDetails.Message
        if ($errMsg -like "*already exists*" -or $errMsg -like "*duplicate*") {
            Write-OK "Bucket '$nome' ja existe"
        } else {
            Write-Fail "Erro ao criar bucket '$nome': $errMsg"
        }
    }
}

New-Bucket "covers"  $true
New-Bucket "parquet" $false

# Tornar covers publico
try {
    $body2 = '{"public":true}'
    $null = Invoke-RestMethod -Uri "$SUPA_URL/storage/v1/bucket/covers" -Method PUT -Headers $headers -Body $body2 -ErrorAction Stop
    Write-OK "Bucket 'covers' marcado como publico"
} catch {
    Write-Warn "Nao foi possivel atualizar politica - configure manualmente no Supabase Storage se necessario"
}

# Listar buckets
try {
    $buckets = Invoke-RestMethod -Uri "$SUPA_URL/storage/v1/bucket" -Headers $headers -ErrorAction Stop
    $nomes = ($buckets | ForEach-Object { $_.name }) -join ", "
    Write-OK "Buckets ativos: $nomes"
} catch {
    Write-Warn "Nao foi possivel listar buckets: $($_.Exception.Message)"
}

# -------------------------------------------------------
# 3. Testar conexao com banco
# -------------------------------------------------------
Write-Step "3/5  Testando conexao com o banco de dados"

if ($DB_URL -ne "") {
    # Extrai host e porta da URL manualmente
    try {
        $semPrefix = $DB_URL -replace "^postgresql://", "" -replace "^postgres://", ""
        $hostPart  = $semPrefix.Split("@")[1].Split("/")[0]
        $dbHost    = $hostPart.Split(":")[0]
        $dbPort    = if ($hostPart.Contains(":")) { [int]$hostPart.Split(":")[1] } else { 5432 }

        $tcp = New-Object System.Net.Sockets.TcpClient
        $async = $tcp.BeginConnect($dbHost, $dbPort, $null, $null)
        $ok = $async.AsyncWaitHandle.WaitOne(5000, $false)
        $tcp.Close()

        if ($ok) {
            Write-OK "Banco acessivel: ${dbHost}:${dbPort}"
        } else {
            Write-Warn "Timeout ao conectar em ${dbHost}:${dbPort}"
            Write-Warn "Verifique se a DATABASE_URL usa porta 6543 (Transaction mode do Supabase)"
        }
    } catch {
        Write-Warn "Nao foi possivel testar conexao: $($_.Exception.Message)"
    }
} else {
    Write-Warn "DATABASE_URL nao configurada"
}

# -------------------------------------------------------
# 4. Git
# -------------------------------------------------------
Write-Step "4/5  Preparar repositorio Git"

$gitignorePath = Join-Path $PSScriptRoot2 ".gitignore"
$gitignoreContent = @(
    ".env",
    "__pycache__/",
    "*.pyc",
    ".DS_Store",
    "node_modules/",
    "dist/",
    ".venv/",
    "venv/",
    "*.egg-info/",
    ".pytest_cache/",
    "uploads/",
    "data/",
    "*.parquet"
)
[System.IO.File]::WriteAllLines($gitignorePath, $gitignoreContent, [System.Text.Encoding]::UTF8)
Write-OK ".gitignore criado (.env protegido)"

$gitDir = Join-Path $PSScriptRoot2 ".git"
if (-not (Test-Path $gitDir)) {
    $null = git init $PSScriptRoot2
    Write-OK "Repositorio Git inicializado"
} else {
    Write-OK "Repositorio Git ja existe"
}

Push-Location $PSScriptRoot2
try {
    $null = git add .
    $commitOut = git commit -m "Portal BI - configuracao inicial Supabase + Railway" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-OK "Commit criado"
    } elseif ($commitOut -like "*nothing to commit*") {
        Write-OK "Nada novo para commitar"
    } else {
        Write-Warn "Configure o Git antes de commitar:"
        Write-Host "     git config --global user.name  `"Seu Nome`"" -ForegroundColor Yellow
        Write-Host "     git config --global user.email `"seu@email.com`"" -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

# -------------------------------------------------------
# 5. Instrucoes finais
# -------------------------------------------------------
Write-Step "5/5  Proximos passos"

Write-Host ""
Write-Host "  PASSO 1 - Enviar para o GitHub" -ForegroundColor White
Write-Host "  --------------------------------"
Write-Host "  Crie um repositorio em https://github.com/new"
Write-Host "  Depois rode:"
Write-Host "    git remote add origin https://github.com/SEU-USUARIO/portal-bi.git" -ForegroundColor Cyan
Write-Host "    git push -u origin main" -ForegroundColor Cyan
Write-Host ""
Write-Host "  PASSO 2 - Backend no Railway" -ForegroundColor White
Write-Host "  --------------------------------"
Write-Host "  railway.app > New Project > GitHub > Root Directory: backend"
Write-Host "  Copie as variaveis do arquivo .env"
Write-Host ""
Write-Host "  PASSO 3 - Frontend no Railway" -ForegroundColor White
Write-Host "  --------------------------------"
Write-Host "  Add Service > GitHub (mesmo repo) > Root Directory: frontend"
Write-Host "  Variavel: VITE_API_URL = URL do backend gerada pelo Railway"
Write-Host ""
Write-Host "  PASSO 4 - Primeiro acesso" -ForegroundColor White
Write-Host "  --------------------------------"
Write-Host "  E-mail : admin@portalbi.com"
Write-Host "  Senha  : Admin@123  (troque imediatamente!)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Consulte DEPLOY.md para o guia completo." -ForegroundColor Yellow
Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  Setup concluido!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
