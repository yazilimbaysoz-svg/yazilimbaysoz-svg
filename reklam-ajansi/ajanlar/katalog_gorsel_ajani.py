import json, urllib.request, urllib.parse
from PIL import Image, ImageDraw, ImageEnhance

UA = {"User-Agent": "NaztechOtonom/4.0 (https://naztechbilisim.com)"}
SORGULAR = {
    "hikvision_bullet.jpg": ("CCTV camera", "HIKVISION 4K AI | LAVOX"),
    "hikvision_dome.jpg": ("dome camera", "HIKVISION DOME PRO"),
    "hikvision_nvr.jpg": ("rackmount server", "HIKVISION NVR 2026"),
    "alarm.jpg": ("alarm keypad", "LAVOX AKILLI ALARM"),
    "bilisim.jpg": ("server rack", "NAZTECH BİLİŞİM"),
    "yakit.jpg": ("fuel pump", "YAKIT OTOMASYON"),
    "arac_takip.jpg": ("GPS navigation", "N2MOBİL GPS TAKİP"),
    "yazilim.jpg": ("source code", "NAZTECH YAZILIM"),
    "elektrik.jpg": ("switchgear", "NAZTECH ENERJİ")
}
from concurrent.futures import ThreadPoolExecutor
def is_yap(item):
    dosya, (sorgu, etiket) = item
    try:
        p = urllib.parse.urlencode({"action": "query", "format": "json", "generator": "search", "gsrsearch": f"filetype:bitmap {sorgu}", "gsrnamespace": "6", "gsrlimit": "1", "prop": "imageinfo", "iiprop": "url", "iiurlwidth": "1920"})
        u = urllib.parse.urlunparse(("https", "commons.wikimedia.org", "/w/api.php", "", p, ""))
        v = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=15).read().decode())
        iu = list(v["query"]["pages"].values())["imageinfo"].get("thumburl") or list(v["query"]["pages"].values())["imageinfo"]["url"]
        tmp = "/tmp/" + dosya
        with urllib.request.urlopen(urllib.request.Request(iu, headers=UA), timeout=20) as r, open(tmp, "wb") as f: f.write(r.read())
        im = Image.open(tmp).convert("RGB")
        w, h = im.size
        im = im.crop(((w - int(h*16/9))//2, 0, (w + int(h*16/9))//2, h)) if w/h > 16/9 else im.crop((0, (h - int(w*9/16))//2, w, (h + int(w*9/16))//2))
        im = ImageEnhance.Contrast(im.resize((1920, 1080), Image.Resampling.LANCZOS)).enhance(1.08)
        d = ImageDraw.Draw(im)
        d.rectangle((40, 975, 560, 1040), fill=(4, 8, 15))
        d.rectangle((40, 975, 48, 1040), fill=(25, 167, 184))
        d.text((66, 998), f"LAVOX ELECTRONICS  |  {etiket}", fill=(212, 175, 55))
        im.save("img/" + dosya, "JPEG", quality=92, optimize=True)
        print("EŞ ZAMANLI TAMAM:", dosya)
    except Exception as e: print("HATA:", dosya, e)
with ThreadPoolExecutor(max_workers=8) as ex: list(ex.map(is_yap, SORGULAR.items()))
