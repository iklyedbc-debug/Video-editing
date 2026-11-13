#!/usr/bin/env bash
# Usage: ./encode_with_intro.sh <introFrames> <mainFrames> <sound.wav> <out.mp4>
# Intro (3.2 s) dissolves into the zoom over 0.5 s (hook text identical in both), so the cut is seamless.
set -e
ffmpeg -y -framerate 24 -i "$1/f%04d.png" -framerate 24 -i "$2/f%04d.png" -i "$3" -filter_complex "\
[0]setsar=1,format=yuv420p[a];\
[1]setsar=1,format=yuv420p[b];\
[a][b]xfade=transition=fade:duration=0.5:offset=2.7,minterpolate=fps=30:mi_mode=blend,format=yuv420p[v]" \
  -map "[v]" -map 2:a -c:v libx264 -preset slow -crf 17 -c:a aac -b:a 192k -shortest -movflags +faststart "$4"
