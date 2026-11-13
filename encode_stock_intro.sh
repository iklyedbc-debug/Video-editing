#!/usr/bin/env bash
# Real-footage intro (Mixkit clip 43268, free Mixkit licence) -> dissolve into the zoom.
# Usage: ./encode_stock_intro.sh <stock.mp4> <hook.png> <mainFrames> <sound.wav> <out.mp4>
set -e
ZOOM="if(lt(on,40),1+0.08*on/40,1.08+1.52*pow((on-40)/36,2))"
P="(zoom-1)/1.6"
ffmpeg -y -ss 0.4 -t 3.25 -i "$1" -loop 1 -i "$2" -framerate 24 -i "$3/f%04d.png" -i "$4" -filter_complex "\
[0]fps=24,scale=1440:2560:flags=lanczos,\
zoompan=z='$ZOOM':x='(720+280*$P)-iw/zoom/2':y='(1280-300*$P)-ih/zoom/2':d=1:s=720x1280:fps=24,\
eq=brightness=-0.03:saturation=0.95,vignette=PI/5,setsar=1[clip];\
[clip][1]overlay=0:0:shortest=1,trim=end_frame=77,setpts=PTS-STARTPTS,format=yuv420p[a];\
[2]setsar=1,format=yuv420p[b];\
[a][b]xfade=transition=fade:duration=0.5:offset=2.7,minterpolate=fps=30:mi_mode=blend,format=yuv420p[v]" \
  -map "[v]" -map 3:a -c:v libx264 -preset slow -crf 17 -c:a aac -b:a 192k -shortest -movflags +faststart "$5"
