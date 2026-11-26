import os, subprocess
from playwright.sync_api import sync_playwright

def video_render_al(genislik=1080, yukseklik=1920, fps=30, sure=10):
    kok = "/home/muslumbaysoz/projeler/naztech-bilisim/reklam-ajansi"
    kare_dir = f"{kok}/sahneler/kareler"
    os.makedirs(kare_dir, exist_ok=True)
    toplam_kare = fps * sure
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/brave", args=["--use-gl=angle", "--use-angle=swiftshader"])
        page = browser.new_page(viewport={"width": genislik, "height": yukseklik})
        page.goto(f"file://{kok}/sahneler/sahne_3d.html", wait_until="networkidle")
        for i in range(toplam_kare):
            page.evaluate(f"window.setTime({i / fps:.4f})")
            page.screenshot(path=f"{kare_dir}/f_{i:04d}.png")
        browser.close()
    cikti = f"{kok}/cikti/naztech_3d_reels.mp4"
    subprocess.run(["ffmpeg", "-y", "-framerate", str(fps), "-i", f"{kare_dir}/f_%04d.png", "-i", f"{kok}/sesler/reklam_ses.wav", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", cikti], check=True)
    print(f"RENDER SANATÇISI AJAN: Video hazır -> {cikti}")

if __name__ == "__main__":
    video_render_al()
