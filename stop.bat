@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "PIDFILE=%~dp0.hoja-server.pid"
set "TOKENFILE=%~dp0.hoja-server.token"

if not exist "%PIDFILE%" (
  echo Hoja Personal CV Studio ya esta detenido.
  exit /b 0
)

set "SERVERPID="
set /p SERVERPID=<"%PIDFILE%"
if not defined SERVERPID goto :stale

echo %SERVERPID%| findstr /r "^[0-9][0-9]*$" >nul
if errorlevel 1 goto :stale

set "INSTANCE_TOKEN="
if exist "%TOKENFILE%" set /p INSTANCE_TOKEN=<"%TOKENFILE%"
if not defined INSTANCE_TOKEN goto :stale

rem Valida PID + python.exe + server.py + token unico antes de matar nada.
powershell -NoProfile -Command "$p=Get-CimInstance Win32_Process -Filter 'ProcessId=%SERVERPID%' -ErrorAction SilentlyContinue; if(-not $p){exit 2}; $cmd=[string]$p.CommandLine; $name=[string]$p.Name; if($name -notmatch '^python(w)?\.exe$'){exit 3}; if($cmd -notmatch 'server\.py'){exit 4}; if($cmd -notlike '*%INSTANCE_TOKEN%*'){exit 5}; exit 0" >nul 2>nul
set "CHECK=%ERRORLEVEL%"
if not "%CHECK%"=="0" goto :stale

echo Deteniendo Hoja Personal CV Studio ^(PID %SERVERPID%^) ...
taskkill /PID %SERVERPID% /T >nul 2>nul
if errorlevel 1 (
  taskkill /PID %SERVERPID% /T /F >nul 2>nul
)

rem Espera brevemente y comprueba que haya terminado.
powershell -NoProfile -Command "for($i=0;$i -lt 20;$i++){if(-not (Get-Process -Id %SERVERPID% -ErrorAction SilentlyContinue)){exit 0}; Start-Sleep -Milliseconds 100}; exit 1" >nul 2>nul
if errorlevel 1 (
  echo No se pudo confirmar que el proceso %SERVERPID% terminara.
  echo Puedes cerrar manualmente la consola de run.bat si sigue abierta.
  exit /b 1
)

del /q "%PIDFILE%" >nul 2>nul
del /q "%TOKENFILE%" >nul 2>nul
echo Servidor detenido correctamente.
exit /b 0

:stale
echo El archivo PID estaba obsoleto o no pertenecia a esta instancia.
echo No se cerro ningun otro proceso de Python.
del /q "%PIDFILE%" >nul 2>nul
del /q "%TOKENFILE%" >nul 2>nul
exit /b 0
