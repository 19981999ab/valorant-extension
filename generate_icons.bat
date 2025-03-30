@echo off
echo Creating icon directory if it doesn't exist...
if not exist icons mkdir icons

echo Getting current directory...
cd /d "%~dp0"
echo Current directory: %CD%

echo Checking if SVG file exists...
if not exist icon.svg (
    echo ERROR: icon.svg not found in the current directory!
    echo Creating a basic SVG file...
    
    echo ^<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"^> > icon.svg
    echo ^  ^<rect width="128" height="128" fill="#ff4655" rx="20" ry="20"/^> >> icon.svg
    echo ^  ^<text x="64" y="80" font-family="Arial, sans-serif" font-size="80" text-anchor="middle" fill="white"^>V^</text^> >> icon.svg
    echo ^</svg^> >> icon.svg
    
    echo Created new icon.svg file.
)

echo Checking if ImageMagick is installed...
where magick >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Found ImageMagick, generating icons...
    
    echo Generating 16x16 icon...
    magick "%CD%\icon.svg" -resize 16x16 "%CD%\icons\icon16.png"
    
    echo Generating 32x32 icon...
    magick "%CD%\icon.svg" -resize 32x32 "%CD%\icons\icon32.png"
    
    echo Generating 48x48 icon...
    magick "%CD%\icon.svg" -resize 48x48 "%CD%\icons\icon48.png"
    
    echo Generating 128x128 icon...
    magick "%CD%\icon.svg" -resize 128x128 "%CD%\icons\icon128.png"
    
    echo Icons generated successfully!
) else (
    echo ImageMagick not found. Please install it or use an online converter.
    echo Visit: https://imagemagick.org/script/download.php
    echo.
    echo Alternative: Use an online SVG to PNG converter:
    echo 1. Go to https://convertio.co/svg-png/
    echo 2. Upload icon.svg and convert to PNG
    echo 3. Save the files as icons/icon16.png, icons/icon32.png, etc.
)

echo.
echo Files in icons directory:
dir "%CD%\icons\*.png" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo No icon files found.
)

pause
