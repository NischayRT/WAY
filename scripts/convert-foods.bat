@echo off
cd /d "%~dp0\.."

if not exist "foods-template.csv" (
    echo.
    echo ERROR: foods-template.csv not found in the project root.
    echo.
    echo Fill in templates\foods-template.csv, download it as CSV,
    echo and save it at the project root as exactly: foods-template.csv
    echo.
    pause
    exit /b 1
)

echo Converting foods-template.csv to SQL...
node scripts\generate-food-inserts.js foods-template.csv > supabase\generated-foods.sql

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Something went wrong during conversion. Check that foods-template.csv
    echo has the correct header row and no missing commas.
    echo.
    pause
    exit /b 1
)

echo.
echo Done. SQL written to supabase\generated-foods.sql
echo Open that file, copy everything in it, and paste + Run it
echo in the Supabase SQL editor.
echo.
pause