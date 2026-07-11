@echo off
rem Compagnon de recherche LinkedIn — double-clic pour lancer.
rem Optionnel : glisser-déposer non supporté, mais tu peux passer un domaine :
rem   rechercher.bat data      (cherche le domaine dont le nom contient "data")
cd /d "%~dp0"
node rechercher.mjs %*
echo.
pause
