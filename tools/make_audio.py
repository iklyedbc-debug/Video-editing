# Synthesises the soundtrack: drone pad + rising tick per halving + final impact.
import numpy as np, wave, sys
OFF=float(sys.argv[2]) if len(sys.argv)>2 else 0.0  # seconds of intro before the zoom video
SR=44100; DUR=27.0+OFF; LMAX=26; ZS=0.6; ZE=23.0
def level(sec):
    sec=sec-OFF
    if sec<=ZS: return 0.0
    if sec>=ZE: return float(LMAX)
    u=(sec-ZS)/(ZE-ZS); a=0.06*0.06/0.12; b=1-0.04*0.04/0.08
    if u<0.06: v=u*u/0.12
    elif u>0.96: v=1-(1-u)**2/0.08
    else: v=a+(u-0.06)*(b-a)/0.9
    return v*LMAX
t=np.arange(int(SR*DUR))/SR
out=np.zeros_like(t)
# drone: A minor-ish pad, slowly opening filter via harmonics
for f,amp in [(55,.30),(110,.18),(164.8,.10),(220,.07),(261.6,.05)]:
    lfo=1+.003*np.sin(2*np.pi*.13*t+f)
    out+=amp*np.sin(2*np.pi*f*lfo*t)*(0.6+0.4*np.sin(2*np.pi*.07*t+f)**2)
prog=np.clip(t/(ZE+OFF),0,1)
shimmer=sum(np.sin(2*np.pi*f*t)*.03 for f in (440,659.3,880))*prog**2
out=out*.55+shimmer
env=np.minimum(1,t/1.0)*np.where(t>25.5+OFF,np.maximum(0,(DUR-t)/1.5),1)
out*=env
# ticks at each integer level crossing
secs=np.arange(0,DUR,1/1000.)
lv=np.array([level(s) for s in secs])
for n in range(1,LMAX+1):
    idx=np.argmax(lv>=n)
    if lv[idx]<n: continue
    s0=secs[idx]; i0=int(s0*SR); L=int(.18*SR)
    tt=np.arange(L)/SR
    f=600*2**(n/14)
    tick=(np.sin(2*np.pi*f*tt)+.4*np.sin(2*np.pi*2*f*tt))*np.exp(-tt*28)*.22
    out[i0:i0+L]+=tick[:len(out)-i0]
# whoosh noise rising during zoom
rng=np.random.default_rng(1)
noise=rng.standard_normal(len(t))
k=np.ones(200)/200; noise=np.convolve(noise,k,'same')*6
out+=noise*.05*np.clip((t-OFF-ZS)/(ZE-ZS),0,1)*(t<ZE+OFF)
# intro: soft swell as the glass rises toward the lips
if OFF>0:
    sw=np.clip(t/OFF,0,1)**2*(t<OFF+.4)*np.exp(-np.maximum(t-OFF,0)*6)
    out+=noise*.09*sw
    i0=int((OFF-.05)*SR); tt=np.arange(int(1.2*SR))/SR
    out[i0:i0+len(tt)]+=(np.sin(2*np.pi*1318.5*tt)+.5*np.sin(2*np.pi*2637*tt))*np.exp(-tt*5)*.06
# impact at reveal (~23.6s)
i0=int((23.4+OFF)*SR); tt=np.arange(int(3.5*SR))/SR
boom=(np.sin(2*np.pi*48*tt*(1-.25*tt/3.5))*np.exp(-tt*1.6)*.7 + np.sin(2*np.pi*523.25*tt)*np.exp(-tt*1.2)*.08+np.sin(2*np.pi*784*tt)*np.exp(-tt*1.4)*.05)
out[i0:i0+len(boom)]+=boom[:len(out)-i0]
out/=np.max(np.abs(out))*1.12
st=np.stack([out,np.roll(out,90)],1)
data=(st*32767).astype(np.int16)
with wave.open(sys.argv[1],'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print('ok')
