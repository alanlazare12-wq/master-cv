@echo off
cd /d "%~dp0"
echo Hoja Personal CV Studio no requiere dependencias para crear CV, ATS, DOCX o TXT.
echo.
echo PDF importado es opcional. Intentando instalar pypdf...
python -m pip install -r requirements-optional.txt
if %errorlevel% neq 0 (
  echo.
  echo No se pudo instalar pypdf. La app seguira funcionando; usa DOCX o TXT para importar.
)
echo.
echo Listo. Ejecuta run.bat
pause
