import json, subprocess
kok = "/home/muslumbaysoz/projeler/naztech-bilisim/reklam-ajansi"
data = json.load(open(f"{kok}/hikaye_senaryo.json", encoding="utf-8"))
for s in data["sahneler"]:
    ses_adi = "tr-TR-AhmetNeural"
    cikti = f"{kok}/sesler/sahne_{s['no']}.mp3"
    subprocess.run(["edge-tts", "--voice", ses_adi, "--text", s["ses"], "--write-media", cikti], check=True)
    print(f"SESLENDİRMEN AJAN: Sahne {s['no']} sesi hazır -> sahne_{s['no']}.mp3")
