import subprocess, os
kok = "/home/muslumbaysoz/projeler/naztech-bilisim/reklam-ajansi"
for ajan in ["cinema_director.py", "sound_designer.py", "render_artist.py"]:
    subprocess.run(["/home/muslumbaysoz/.local/share/uv/tools/playwright/bin/python", f"{kok}/ajanlar/{ajan}"], check=True)
os.system("python3 ~/.local/bin/baysoz-ses.py basari")
print("TÜM AJANLAR GÖREVİ TAMAMLADI -> cikti/naztech_3d_reels.mp4")
