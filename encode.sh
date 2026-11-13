#!/usr/bin/env bash
# Usage: ./encode.sh <framesDir> <sound.wav> <out.mp4>
set -e
ffmpeg -y -framerate 24 -i "$1/f%04d.png" -i "$2" \
  -vf "minterpolate=fps=30:mi_mode=blend,format=yuv420p" \
  -c:v libx264 -preset slow -crf 17 -c:a aac -b:a 192k -shortest -movflags +faststart "$3"
