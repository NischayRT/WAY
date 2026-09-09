@echo off
cd /d "%~dp0\.."

if not exist "ingredients-data.csv" (
    echo.
    echo ERROR: ingredients-data.csv not found in the project root.
    echo.
    echo Fill in templates\ingredients-template.csv, download it as CSV,
    echo and save it at the project root as exactly: ingredients-data.csv
    echo.
    pause
    exit /b 1
)

echo Converting ingredients-data.csv to SQL...
node scripts\generate-ingredients-inserts.js ingredients-data.csv > supabase\generated-ingredients.sql

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Something went wrong during conversion. Check that
    echo ingredients-data.csv has the correct header row and no
    echo missing commas.
    echo.
    pause
    exit /b 1
)

echo.
echo Done. SQL written to supabase\generated-ingredients.sql
echo Open that file, copy everything in it, and paste + Run it
echo in the Supabase SQL editor.
echo.
pause