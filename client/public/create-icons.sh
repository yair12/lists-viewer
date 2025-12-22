#!/bin/bash
# Create placeholder PWA icons using ImageMagick
convert -size 192x192 xc:#1976d2 -gravity center -pointsize 120 -fill white -annotate +0+0 "L" pwa-192x192.png
convert -size 512x512 xc:#1976d2 -gravity center -pointsize 320 -fill white -annotate +0+0 "L" pwa-512x512.png
convert -size 192x192 xc:#1976d2 -gravity center -pointsize 120 -fill white -annotate +0+0 "L" pwa-maskable-192x192.png
convert -size 512x512 xc:#1976d2 -gravity center -pointsize 320 -fill white -annotate +0+0 "L" pwa-maskable-512x512.png
convert -size 180x180 xc:#1976d2 -gravity center -pointsize 110 -fill white -annotate +0+0 "L" apple-touch-icon.png
