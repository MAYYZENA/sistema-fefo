@echo off
echo ========================================
echo   SERVIDOR LOCAL - Sistema FEFO
echo ========================================
echo.
echo Iniciando servidor em http://localhost:8080
echo.
echo Pressione Ctrl+C para parar o servidor
echo ========================================
echo.

cd /d "%~dp0"
python -m http.server 8080

pause
