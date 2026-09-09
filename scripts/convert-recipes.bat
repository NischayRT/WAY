@echo off
cd /d "%~dp0\.."

if not exist "recipes-data.csv" (
    echo.
    echo ERROR: recipes-data.csv not found in the project root.
    echo.
    echo Fill in templates\recipes-template.csv, download it as CSV,
    echo and save it at the project root as exactly: recipes-data.csv
    echo.
    pause
    exit /b 1
)

echo Converting recipes-data.csv to SQL...
node scripts\generate-recipe-inserts.js recipes-data.csv > supabase\generated-recipes.sql

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Something went wrong during conversion. Check that
    echo recipes-data.csv has the correct header row and no
    echo missing commas.
    echo.
    pause
    exit /b 1
)

echo.
echo Done. SQL written to supabase\generated-recipes.sql
echo Open that file, copy everything in it, and paste + Run it
echo in the Supabase SQL editor.
echo.
echo Note: dish_name must exactly match a name already in your
echo foods table, or that dish's rows are silently skipped.
echo.
pause
