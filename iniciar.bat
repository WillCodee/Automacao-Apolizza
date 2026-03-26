@echo off
echo Iniciando servidor local do Dashboard...
echo.
echo Acesse: http://localhost:8080
echo.
echo Pressione CTRL+C para parar o servidor.
echo.
start "" "http://localhost:8080"
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
