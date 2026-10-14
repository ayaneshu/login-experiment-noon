"""Copies the Xcode asset catalog, fonts and sounds into public/ for the web prototype.

One file per imageset, named after the imageset: the SVG if there is one, otherwise the
largest PNG/JPEG. Re-run after the iOS assets change.
"""
import json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "Noon" / "Assets.xcassets"
PUBLIC = Path(__file__).resolve().parents[1] / "public"

def best_file(imageset: Path):
    contents = json.loads((imageset / "Contents.json").read_text())
    files = [img.get("filename") for img in contents.get("images", []) if img.get("filename")]
    svgs = [f for f in files if f.lower().endswith((".svg", ".pdf"))]
    if svgs:
        return imageset / svgs[0]
    def rank(name):
        for i, s in enumerate(["@3x", "@2x"]):
            if s in name: return i
        return 2
    rasters = sorted(files, key=rank)
    return imageset / rasters[0] if rasters else None

out = PUBLIC / "assets"
out.mkdir(parents=True, exist_ok=True)
manifest = {}
for imageset in sorted(CATALOG.rglob("*.imageset")):
    src = best_file(imageset)
    if not src or not src.exists():
        continue
    name = imageset.stem
    dest = out / f"{name}{src.suffix.lower()}"
    shutil.copy2(src, dest)
    manifest[name] = dest.name
(out / "manifest.json").unlink(missing_ok=True)
(PUBLIC.parent / "src" / "design" / "assetManifest.json").write_text(json.dumps(manifest, indent=2))

for folder, sub in (("Fonts", "fonts"), ("Sounds", "sounds")):
    target = PUBLIC / sub
    target.mkdir(exist_ok=True)
    for f in (ROOT / "Noon" / "Resources" / folder).iterdir():
        if f.is_file():
            shutil.copy2(f, target / f.name)
print(f"{len(manifest)} images")
