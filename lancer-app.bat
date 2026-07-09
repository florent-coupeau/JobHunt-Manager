@echo off
rem Teste la webapp en local (avant ou après sa mise en ligne).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable — installe-le depuis https://nodejs.org puis relance.
  pause
  exit /b 1
)
start "" http://localhost:8500/connexion.html
node serveur-dev.js
