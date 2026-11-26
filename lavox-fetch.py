import urllib.request, re, json, html, os

CATS = [
    ("Kamera Sistemleri", "https://www.lavoxelektronik.com/guvenlik-kameralari"),
    ("NVR / DVR & Alarm", "https://lavoxelektronik.com"),
    ("HD-TVI Kameralar", "https://www.lavoxelektronik.com/hd-tvi-kameralar"),
    ("Bilişim & Bilgisayar", "https://lavoxelektronik.com"),
    ("Barkod & Baskı (OT-VT)", "https://lavoxelektronik.com"),
]

items = []
seen = set()
hdr = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0"}

for cat_name, url in CATS:
    try:
        req = urllib.request.Request(url, headers=hdr)
        page = urllib.request.urlopen(req, timeout=12).read().decode("utf-8", "ignore")
        # Ticimax/IdeaSoft urun kartlarini yakala
        blocks = re.findall(r'<div[^>]*class="[^"]*(?:productItem|Showcase|product-item|item)[^"]*"[^>]*>([\s\S]{150,3500}?)</div>\s*</div>', page)
        for b in blocks:
            t_m = re.search(r'(?:title|alt)="([^"]{6,120})"', b)
            i_m = re.search(r'(?:data-original|data-src|src)="(https?://[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"', b, re.I)
            l_m = re.search(r'href="(/[^"]+)"', b)
            if t_m and i_m:
                title = html.unescape(t_m.group(1)).strip()
                if title in seen or any(x in title.lower() for x in ["logo", "banner", "kampanya"]):
                    continue
                seen.add(title)
                img_url = i_m.group(1)
                prod_url = "https://www.lavoxelektronik.com" + l_m.group(1) if l_m else url
                fname = f"img/lavox/lvx_{len(items)+1}.jpg"
                try:
                    urllib.request.urlretrieve(img_url, fname)
                    local_img = fname
                except Exception:
                    local_img = img_url
                items.append({"cat": cat_name, "title": title, "img": local_img, "url": prod_url})
                if len([x for x in items if x["cat"] == cat_name]) >= 6:
                    break
    except Exception as e:
        print("Atlandi:", url, e)

with open("lavox-katalog.json", "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, indent=2)
print(f"TOPLAM {len(items)} ADET GERCEK LAVOX URUNU CEKILDI!")
