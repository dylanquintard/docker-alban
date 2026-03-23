param(
  [Parameter(Mandatory = $true)]
  [string]$DumpPath
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$resolvedDumpPath = Resolve-Path -Path $DumpPath

if (-not (Test-Path -Path $resolvedDumpPath -PathType Leaf)) {
  throw "Dump introuvable: $DumpPath"
}

$dumpFileName = Split-Path -Leaf $resolvedDumpPath
$containerDumpPath = "/tmp/$dumpFileName"
$dumpExtension = [System.IO.Path]::GetExtension($resolvedDumpPath).ToLowerInvariant()

Write-Host "Demarrage de PostgreSQL..."
docker compose -f "$rootDir\compose.yaml" up -d postgres | Out-Null

Write-Host "Attente de la disponibilite de PostgreSQL..."
for ($i = 0; $i -lt 30; $i++) {
  docker compose -f "$rootDir\compose.yaml" exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' *> $null
  if ($LASTEXITCODE -eq 0) {
    break
  }
  Start-Sleep -Seconds 2
}

docker compose -f "$rootDir\compose.yaml" exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' *> $null
if ($LASTEXITCODE -ne 0) {
  throw "PostgreSQL n'est pas pret a recevoir le dump."
}

Write-Host "Recreation de la base cible..."
docker compose -f "$rootDir\compose.yaml" exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '\''$POSTGRES_DB'\'' AND pid <> pg_backend_pid();" -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";" -c "CREATE DATABASE \"$POSTGRES_DB\";"'

if ($LASTEXITCODE -ne 0) {
  throw "Impossible de recreer la base cible."
}

Write-Host "Copie du dump dans le conteneur..."
docker compose -f "$rootDir\compose.yaml" cp "$resolvedDumpPath" "postgres:$containerDumpPath" | Out-Null

if ($dumpExtension -eq ".dump" -or $dumpExtension -eq ".backup" -or $dumpExtension -eq ".bak") {
  Write-Host "Restauration du dump PostgreSQL custom..."
  docker compose -f "$rootDir\compose.yaml" exec -T postgres sh -lc "pg_restore --verbose --clean --if-exists --no-owner --no-privileges -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" `"$containerDumpPath`""
} else {
  Write-Host "Import du dump SQL..."
  docker compose -f "$rootDir\compose.yaml" exec -T postgres sh -lc "psql -v ON_ERROR_STOP=1 -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" -f `"$containerDumpPath`""
}

if ($LASTEXITCODE -ne 0) {
  throw "L'import SQL a echoue."
}

Write-Host "Import termine."
