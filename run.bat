@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "PIDFILE=%~dp0.hoja-server.pid"
set "TOKENFILE=%~dp0.hoja-server.token"

set "PYTHON_CMD="

where py >nul 2>nul
if not errorlevel 1 (
  py -3.14 -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=py -3.14"
  if not defined PYTHON_CMD (
    py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
    if not errorlevel 1 set "PYTHON_CMD=py -3"
  )
)

if not defined PYTHON_CMD (
  where python >nul 2>nul
  if not errorlevel 1 (
    python -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" >nul 2>nul
    if not errorlevel 1 set "PYTHON_CMD=python"
  )
)

if not defined PYTHON_CMD (
  echo Python 3.10+ no esta disponible.
  echo Instala Python 3 o habilita el launcher py.exe y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

rem Si existe un PID anterior, comprueba si sigue vivo antes de arrancar otra instancia.
if exist "%PIDFILE%" (
  set "OLDPID="
  set /p OLDPID=<"%PIDFILE%"
  if defined OLDPID (
    powershell -NoProfile -Command "$raw=(Get-Content -LiteralPath $env:PIDFILE -Raw -ErrorAction SilentlyContinue).Trim(); $serverPid=0; if(-not [int]::TryParse($raw,[ref]$serverPid)){exit 1}; $p=Get-Process -Id $serverPid -ErrorAction SilentlyContinue; if($p){exit 0}else{exit 1}" >nul 2>nul
    if not errorlevel 1 (
      echo Hoja Personal CV Studio ya esta ejecutandose ^(PID !OLDPID!^).
      echo Usa stop.bat para detener esa instancia antes de iniciar otra.
      pause
      exit /b 0
    )
  )
  del /q "%PIDFILE%" >nul 2>nul
  del /q "%TOKENFILE%" >nul 2>nul
)

for /f %%G in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')"') do set "INSTANCE_TOKEN=%%G"
if not defined INSTANCE_TOKEN (
  echo No se pudo generar el identificador de instancia.
  pause
  exit /b 1
)
>"%TOKENFILE%" echo %INSTANCE_TOKEN%

echo Iniciando Hoja Personal CV Studio v48...
echo Para detener el servidor usa stop.bat desde esta misma carpeta.
echo.
%PYTHON_CMD% server.py --pid-file "%PIDFILE%" --instance-token "%INSTANCE_TOKEN%"
set "RC=%ERRORLEVEL%"

del /q "%PIDFILE%" >nul 2>nul
del /q "%TOKENFILE%" >nul 2>nul

if not "%RC%"=="0" (
  echo.
  echo El servidor termino con codigo %RC%.
  pause
)
exit /b %RC%
