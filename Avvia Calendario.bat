@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
call npm run build || goto :errore
start "" "dist\index.html"
exit /b

:errore
echo.
echo Build fallita. Copia il messaggio qui sopra.
pause
