import json, os, subprocess
kok = "/home/muslumbaysoz/projeler/naztech-bilisim/reklam-ajansi"
data = json.load(open(f"{kok}/hikaye_senaryo.json", encoding="utf-8"))
klipler = []
for s in data["sahneler"]:
    no = s["no"]
    gorsel = f"{kok}/sahneler/sahne{no}.png"
    ses = f"{kok}/sesler/sahne_{no}.mp3"
    klip = f"{kok}/sahneler/klip_{no}.mp4"
    if not os.path.exists(gorsel):
        print(f"EKSİK SAHNE: {gorsel}"); exit(1)
    yazi = s["altyazi"].replace(":", "\\:")
    vf = f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0012,1.12)':d=125:s=1080x1920,drawtext=text='{yazi}':fontcolor=white:fontsize=44:box=1:boxcolor=black@0.65:boxborderw=18:x=(w-text_w)/2:y=h-260"
    subprocess.run(["ffmpeg", "-y", "-loop", "1", "-i", gorsel, "-i", ses, "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", klip], check=True)
    klipler.append(f"file '{klip}'\n")
open(f"{kok}/sahneler/liste.txt", "w").writelines(klipler)
cikti = f"{kok}/cikti/naztech_sinematik_reels.mp4"
subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", f"{kok}/sahneler/liste.txt", "-c", "copy", cikti], check=True)
os.system("python3 ~/.local/bin/baysoz-ses.py basari")
print(f"KURGU MOTORU: Sinematik Reels hazır -> {cikti}")
