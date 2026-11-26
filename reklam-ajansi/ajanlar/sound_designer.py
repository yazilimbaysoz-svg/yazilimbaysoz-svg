import math, wave, array

def sinematik_ses_uret(sure=10.0, sr=44100):
    n = int(sr * sure)
    buf = array.array("h", [0] * n)
    akor = [130.81, 196.00, 246.94, 329.63]
    for i in range(n):
        t = i / sr
        s = 0.0
        if t < 2.8:
            s += 0.55 * math.sin(2 * math.pi * (85 * math.exp(-1.4 * t) + 32) * t) * math.exp(-1.2 * t)
        if 3.0 <= t < 6.2:
            t2 = t - 3.0
            s += 0.35 * math.sin(2 * math.pi * (180 + 420 * math.exp(-2.5 * t2)) * t2) * math.exp(-1.5 * t2)
        if t >= 6.5:
            t3 = t - 6.5
            for f in akor:
                s += 0.14 * math.sin(2 * math.pi * f * t3) * math.exp(-0.9 * t3)
        buf[i] = int(max(-0.95, min(0.95, s)) * 32767)
    yol = "/home/muslumbaysoz/projeler/naztech-bilisim/reklam-ajansi/sesler/reklam_ses.wav"
    with wave.open(yol, "w") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(sr)
        wf.writeframes(buf.tobytes())
    print("SES TASARIMCISI AJAN: Sinematik ses miksajı hazır -> reklam_ses.wav")

if __name__ == "__main__":
    sinematik_ses_uret()
