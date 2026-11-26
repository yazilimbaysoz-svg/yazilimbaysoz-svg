import json
hikaye = {
  "baslik": "Patron Uygun Fiyatlı Kamera Arıyor - NAZTECH BİLİŞİM",
  "sahneler": [
    {"no": 1, "sure": 3.5, "gorsel": "sahne1_patron_kafa_kasiyor.png", "ses": "İş yerime hem kaliteli hem uygun fiyatlı kamera lazım, nerede bulacağım?", "altyazi": "Kaliteli & Uygun Fiyatlı Kamera Nerede?"},
    {"no": 2, "sure": 3.0, "gorsel": "sahne2_arkadas_iceri_giriyor.png", "ses": "Hâlâ bulamadın mı dostum? Bak Naztech Bilişim var!", "altyazi": "Hâlâ Bulamadın mı? Bak NAZTECH BİLİŞİM Var!"},
    {"no": 3, "sure": 4.0, "gorsel": "sahne3_google_naztech.png", "ses": "Google'a Naztech Bilişim yaz, bütçene en uygun LAVOX sistemleri anında çıksın!", "altyazi": "Google'a Yaz: NAZTECH BİLİŞİM"},
    {"no": 4, "sure": 3.5, "gorsel": "sahne4_patron_mutlu_kapanis.png", "ses": "Şanlıurfa Ana Bayi güvencesiyle hemen teklif al: naztechbilisim.com", "altyazi": "LAVOX Şanlıurfa Ana Bayi | 0553 034 18 94"}
  ]
}
with open("/home/muslumbaysoz/projeler/naztech-bilisim/reklam-ajansi/hikaye_senaryo.json", "w", encoding="utf-8") as f:
    json.dump(hikaye, f, ensure_ascii=False, indent=2)
print("HİKAYE YÖNETMENİ: 4 sahneli viral senaryo hazır!")
