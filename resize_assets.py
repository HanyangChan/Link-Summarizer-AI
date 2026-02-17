import os
from PIL import Image

assets_dir = r"c:\Users\a7334\OneDrive\Desktop\Preview AI\Link Summarizer AI\store_assets"
targets = {
    "basic_icon_128.png": (128, 128),
    "basic_small_tile_440x280.png": (440, 280),
    "basic_marquee_tile_1400x560.png": (1400, 560),
    "basic_screenshot_1280x800.png": (1280, 800),
    "mascot_icon_128.png": (128, 128),
    "mascot_small_tile_440x280.png": (440, 280),
    "mascot_marquee_tile_1400x560.png": (1400, 560),
    "mascot_screenshot_1280x800.png": (1280, 800),
}

for filename, size in targets.items():
    path = os.path.join(assets_dir, filename)
    if os.path.exists(path):
        img = Image.open(path)
        # Using LANCZOS for high-quality downsampling if supported, else default
        try:
            resample = Image.Resampling.LANCZOS
        except AttributeError:
            resample = Image.ANTIALIAS
            
        resized_img = img.resize(size, resample=resample)
        resized_img.save(path)
        print(f"Resized {filename} to {size}")
    else:
        print(f"File not found: {filename}")
