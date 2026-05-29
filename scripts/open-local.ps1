$ErrorActionPreference = 'Stop'

$AppRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$Url = 'http://127.0.0.1:42873/'
$ServerTitle = 'FinanzasPro - servidor local'

Set-Location $AppRoot

function Pause-And-Exit($Code = 1) {
  Write-Host ''
  Read-Host 'Presiona Enter para cerrar'
  exit $Code
}

function Require-Command($Name, $Help) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Host "No se encontro '$Name'." -ForegroundColor Red
    Write-Host $Help -ForegroundColor Yellow
    Pause-And-Exit 1
  }
}

function Ensure-Pnpm {
  if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    return
  }

  if (Get-Command corepack -ErrorAction SilentlyContinue) {
    Write-Host 'pnpm no esta activo. Intentando activarlo con Corepack...'
    corepack enable
    corepack prepare pnpm@11.4.0 --activate
  }

  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "No se encontro 'pnpm'." -ForegroundColor Red
    Write-Host 'Instalalo con: npm i -g pnpm' -ForegroundColor Yellow
    Pause-And-Exit 1
  }
}

function Test-AppServer {
  try {
    $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return $Response.StatusCode -ge 200 -and $Response.Content -match 'FinanzasPro|/main.tsx'
  } catch {
    return $false
  }
}

function Open-AppBrowser {
  $ChromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )

  $Chrome = $ChromeCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

  if ($Chrome) {
    Start-Process -FilePath $Chrome -ArgumentList $Url
  } else {
    Start-Process $Url
  }
}

Write-Host 'Iniciando FinanzasPro local...' -ForegroundColor Cyan

Require-Command node 'Instala Node.js 20.19+ o 22.12+ desde https://nodejs.org/'
Ensure-Pnpm

if (-not (Test-Path (Join-Path $AppRoot 'node_modules'))) {
  Write-Host 'Instalando dependencias por primera vez...'
  pnpm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Falló pnpm install.' -ForegroundColor Red
    Pause-And-Exit 1
  }
}

if (-not (Test-AppServer)) {
  Write-Host 'Levantando servidor local...'
  $Command = "title $ServerTitle && cd /d `"$AppRoot`" && pnpm dev"
  $ServerProcess = Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', $Command -PassThru

  $Ready = $false
  for ($Attempt = 1; $Attempt -le 45; $Attempt++) {
    Start-Sleep -Seconds 1

    if ($ServerProcess.HasExited) {
      Write-Host 'El servidor se cerro antes de estar listo. Revisa la ventana del servidor.' -ForegroundColor Red
      Pause-And-Exit 1
    }

    if (Test-AppServer) {
      $Ready = $true
      break
    }
  }

  if (-not $Ready) {
    Write-Host "No pude confirmar que la app este lista en $Url" -ForegroundColor Red
    Write-Host 'Si el puerto 42873 esta ocupado, cerra el otro proceso y volve a intentar.' -ForegroundColor Yellow
    Pause-And-Exit 1
  }
}

Write-Host "Abriendo $Url" -ForegroundColor Green
Open-AppBrowser
