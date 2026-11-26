import json, sys

def senaryo_uret(tema="kurumsal", format_tipi="reels"):
    genislik, yukseklik = (1080, 1920) if format_tipi == "reels" else (1920, 1080)
    plan = {
        "ajans": "NAZTECH OTONOM 3D REKLAM AJANSI",
        "marka": "NAZTECH BİLİŞİM & LAVOX ŞANLIURFA ANA BAYİ",
        "format": format_tipi,
        "cozunurluk": [genislik, yukseklik],
        "fps": 30,
        "sure_sn": 10,
        "sahneler": [
            {"id": 1, "baslangic": 0.0, "bitis": 3.0, "baslik": "GÜVENLİĞİN GELECEĞİ", "alt": "ŞANLIURFA ANA BAYİ", "kamera": "orbit_zoom"},
            {"id": 2, "baslangic": 3.0, "bitis": 6.5, "baslik": "4K YAPAY ZEKA OPTİK", "alt": "LAVOX & HIKVISION PRO", "kamera": "macro_scan"},
            {"id": 3, "baslangic": 6.5, "bitis": 10.0, "baslik": "NAZTECH BİLİŞİM", "alt": "naztechbilisim.com | 0553 034 18 94", "kamera": "hero_reveal"}
        ]
    }
    with open("/home/muslumbaysoz/projeler/naztech-bilisim/reklam-ajansi/senaryo.json", "w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)
    print("YÖNETMEN AJAN: Sinematik senaryo hazır -> senaryo.json")

if __name__ == "__main__":
    senaryo_uret(sys.argv[1] if len(sys.argv) > 1 else "kurumsal", sys.argv[2] if len(sys.argv) > 2 else "reels")
