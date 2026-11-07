$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
foreach ($line in Get-Content -LiteralPath (Join-Path $root '.env')) {
    if ($line -match '^([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') }
}
$env:DATABASE_URL = "postgresql://fairround:$($env:POSTGRES_PASSWORD)@127.0.0.1:55432/fairround"
$env:REDIS_URL = 'redis://127.0.0.1:56379'
$env:PUBLIC_URL = 'http://localhost:3000'
