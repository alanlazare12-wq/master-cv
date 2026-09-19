param(
  [switch]$SkipTests,
  [switch]$SkipInstaller,
  [switch]$SkipAppBuild
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$DistRoot = Join-Path $Root 'dist'
$AppDist = Join-Path $DistRoot 'windows'
$InstallerDist = Join-Path $DistRoot 'installer'
$WorkRoot = Join-Path $Root 'build'
$VenvRoot = Join-Path $env:TEMP 'mastercv-build-venv'
$Python = Join-Path $VenvRoot 'Scripts\python.exe'

function Invoke-Checked {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [Parameter(ValueFromRemainingArguments=$true)][string[]]$ArgumentList
  )
  Write-Host ">> $FilePath $($ArgumentList -join ' ')" -ForegroundColor Cyan
  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Comando fallido ($LASTEXITCODE): $FilePath $($ArgumentList -join ' ')"
  }
}

function Find-InnoCompiler {
  $direct = @()
  if (${env:ProgramFiles(x86)}) { $direct += (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe') }
  if ($env:ProgramFiles) { $direct += (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe') }
  if ($env:LOCALAPPDATA) { $direct += (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe') }
  $direct = @($direct | Where-Object { $_ -and (Test-Path $_) })
  if ($direct.Count -gt 0) { return $direct[0] }

  $registryRoots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  $innoEntries = foreach ($item in (Get-ItemProperty $registryRoots -ErrorAction SilentlyContinue)) {
    $nameProp = $item.PSObject.Properties['DisplayName']
    $locationProp = $item.PSObject.Properties['InstallLocation']
    if (-not $nameProp -or -not $locationProp) { continue }

    $displayName = [string]$nameProp.Value
    $installLocation = [string]$locationProp.Value
    if ($displayName -notlike 'Inno Setup*' -or [string]::IsNullOrWhiteSpace($installLocation)) { continue }

    $versionProp = $item.PSObject.Properties['DisplayVersion']
    $versionText = if ($versionProp) { [string]$versionProp.Value } else { '0.0' }
    $version = [version]::new(0, 0)
    [version]::TryParse(($versionText -replace '[^0-9.]',''), [ref]$version) | Out-Null
    [pscustomobject]@{ InstallLocation = $installLocation; Version = $version }
  }

  $entry = $innoEntries | Sort-Object Version -Descending | Select-Object -First 1
  if ($entry) {
    $candidate = Join-Path $entry.InstallLocation 'ISCC.exe'
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

Set-Location $Root

$Exe = Join-Path $AppDist 'MasterCVStudio\MasterCVStudio.exe'

if (-not $SkipAppBuild) {
  if (-not $SkipTests) {
    Invoke-Checked 'npm.cmd' 'run' 'check'
    Invoke-Checked 'npm.cmd' 'test'
    Invoke-Checked 'npm.cmd' 'run' 'test:python'
  }

  if (-not (Test-Path $Python)) {
    Write-Host 'Creando entorno temporal de build...' -ForegroundColor Yellow
    Invoke-Checked 'py.exe' '-3.14' '-m' 'venv' $VenvRoot
  }

  Invoke-Checked $Python '-m' 'pip' 'install' '--disable-pip-version-check' '--upgrade' 'pyinstaller==6.22.3' 'pypdf==6.19.0' 'pywebview==6.2.1'

  Remove-Item $AppDist -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $WorkRoot 'pyinstaller') -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $AppDist, (Join-Path $WorkRoot 'pyinstaller'), $InstallerDist | Out-Null

  $pyInstallerArgs = @(
    '-m', 'PyInstaller',
    '--noconfirm',
    '--clean',
    '--onedir',
    '--windowed',
    '--name', 'MasterCVStudio',
    '--contents-directory', '.',
    '--distpath', $AppDist,
    '--workpath', (Join-Path $WorkRoot 'pyinstaller'),
    '--specpath', $WorkRoot,
    '--collect-submodules', 'pypdf',
    '--collect-all', 'webview',
    '--add-data', "$Root\index.html;.",
    '--add-data', "$Root\styles.css;.",
    '--add-data', "$Root\manifest.webmanifest;.",
    '--add-data', "$Root\sw.js;."
  )
  Get-ChildItem (Join-Path $Root 'src') -Filter '*.js' -File | Sort-Object Name | ForEach-Object {
    $pyInstallerArgs += @('--add-data', "$($_.FullName);src")
  }
  $pyInstallerArgs += (Join-Path $Root 'desktop.py')
  Invoke-Checked $Python @pyInstallerArgs
}

if (-not (Test-Path $Exe)) {
  throw "No se encontró el ejecutable esperado: $Exe"
}

Write-Host "Ejecutable listo: $Exe" -ForegroundColor Green

if (-not $SkipInstaller) {
  $ISCC = Find-InnoCompiler
  if (-not $ISCC) {
    throw 'Inno Setup 6 no está instalado. Instálalo y vuelve a ejecutar este script.'
  }
  Invoke-Checked $ISCC (Join-Path $Root 'installer\MasterCVStudio.iss')
}

$artifacts = @($Exe)
$Setup = Join-Path $InstallerDist 'Hoja-Personal-CV-Studio-v48-Setup.exe'
if (Test-Path $Setup) { $artifacts += $Setup }

Write-Host ''
Write-Host 'Artefactos:' -ForegroundColor Green
foreach ($artifact in $artifacts) {
  $item = Get-Item $artifact
  $hash = (Get-FileHash -Algorithm SHA256 $artifact).Hash
  Write-Host ("- {0} ({1:N2} MB)" -f $artifact, ($item.Length / 1MB))
  Write-Host ("  SHA-256: {0}" -f $hash)
}
