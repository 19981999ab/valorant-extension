# PowerShell script to generate icons for Chrome extension

# Create icons directory if it doesn't exist
if (-not (Test-Path -Path "icons")) {
    New-Item -Path "icons" -ItemType Directory
    Write-Host "Created icons directory"
}

# Check if ImageMagick is installed and in the PATH
$imagemagickInstalled = $null -ne (Get-Command "magick" -ErrorAction SilentlyContinue)

if ($imagemagickInstalled) {
    Write-Host "Converting SVG to PNG files using ImageMagick..."
    
    # Use ImageMagick to convert SVG to PNG - without the problematic transparent parameter
    try {
        # First try with newer syntax
        magick "icon.svg" -resize 16x16 "icons/icon16.png"
        magick "icon.svg" -resize 32x32 "icons/icon32.png"
        magick "icon.svg" -resize 48x48 "icons/icon48.png"
        magick "icon.svg" -resize 128x128 "icons/icon128.png"
        
        Write-Host "Icons generated successfully using magick command!"
    }
    catch {
        # Try alternative syntax if the first one fails
        try {
            Write-Host "First attempt failed, trying alternative syntax..."
            magick convert "icon.svg" -resize 16x16 "icons/icon16.png"
            magick convert "icon.svg" -resize 32x32 "icons/icon32.png"
            magick convert "icon.svg" -resize 48x48 "icons/icon48.png"
            magick convert "icon.svg" -resize 128x128 "icons/icon128.png"
            
            Write-Host "Icons generated successfully using magick convert command!"
        }
        catch {
            Write-Host "Error generating icons: $_"
            Write-Host "Please try using an online converter instead."
        }
    }
} else {
    Write-Host "ImageMagick not found. Please install ImageMagick or use an online converter."
    Write-Host "Visit: https://imagemagick.org/script/download.php"
    Write-Host ""
    Write-Host "Alternative: Use an online SVG to PNG converter:"
    Write-Host "1. Go to https://convertio.co/svg-png/"
    Write-Host "2. Upload icon.svg and convert to PNG"
    Write-Host "3. Save the files as icons/icon16.png, icons/icon32.png, etc."
}

# List the generated files if they exist
if (Test-Path -Path "icons") {
    Write-Host "Files in icons directory:"
    Get-ChildItem -Path "icons" | Format-Table Name, Length
}
