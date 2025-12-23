#!/bin/bash
# Create PWA icons from icon.svg with motion blur effect

if command -v convert &> /dev/null; then
    # Using ImageMagick with motion blur
    # Convert base SVG and apply motion blur
    convert -background none icon-base.svg -resize 192x192 -channel RGBA -motion-blur 0x25-30 temp-192.png
    convert -background none icon-base.svg -resize 192x192 temp-192-sharp.png
    composite -blend 50 temp-192-sharp.png temp-192.png pwa-192x192.png
    
    convert -background none icon-base.svg -resize 512x512 -channel RGBA -motion-blur 0x65-80 temp-512.png
    convert -background none icon-base.svg -resize 512x512 temp-512-sharp.png
    composite -blend 50 temp-512-sharp.png temp-512.png pwa-512x512.png
    
    # Maskable versions
    convert -background none icon-base.svg -resize 192x192 -channel RGBA -motion-blur 0x25-30 temp-mask-192.png
    convert -background none icon-base.svg -resize 192x192 temp-mask-192-sharp.png
    composite -blend 50 temp-mask-192-sharp.png temp-mask-192.png pwa-maskable-192x192.png
    
    convert -background none icon-base.svg -resize 512x512 -channel RGBA -motion-blur 0x65-80 temp-mask-512.png
    convert -background none icon-base.svg -resize 512x512 temp-mask-512-sharp.png
    composite -blend 50 temp-mask-512-sharp.png temp-mask-512.png pwa-maskable-512x512.png
    
    # Apple touch icon
    convert -background none icon-base.svg -resize 180x180 -channel RGBA -motion-blur 0x25-30 temp-apple.png
    convert -background none icon-base.svg -resize 180x180 temp-apple-sharp.png
    composite -blend 50 temp-apple-sharp.png temp-apple.png apple-touch-icon.png
    
    # Clean up temp files
    rm -f temp-*.png
    
    echo "Icons created successfully with motion blur"
elif command -v inkscape &> /dev/null; then
    # Using Inkscape (fallback to simple conversion)
    inkscape icon.svg --export-filename=pwa-192x192.png --export-width=192 --export-height=192
    inkscape icon.svg --export-filename=pwa-512x512.png --export-width=512 --export-height=512
    inkscape icon.svg --export-filename=pwa-maskable-192x192.png --export-width=192 --export-height=192
    inkscape icon.svg --export-filename=pwa-maskable-512x512.png --export-width=512 --export-height=512
    inkscape icon.svg --export-filename=apple-touch-icon.png --export-width=180 --export-height=180
    echo "Icons created successfully with Inkscape"
else
    echo "Error: Neither ImageMagick (convert) nor Inkscape found. Please install one of them."
    exit 1
fi
