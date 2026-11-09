"""Compose Open Peeps (CC0, Pablo Stanley) SVG portraits from the DiceBear
open-peeps.json data file. Reads data only; deterministic per character name."""
import hashlib, json, re, sys, unicodedata
from pathlib import Path
from xml.sax.saxutils import quoteattr

DATA = json.loads(Path(sys.argv[1]).read_text("utf-8"))
OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
NAMES = ["An","Bình","Chi","Dũng","Giang","Hà","Lan","Minh","Nam",
         "Hùng","Khoa","Long","Mai","Ngọc","Oanh","Phúc","Quân",
         "Sơn","Tâm","Thảo","Trang","Tuấn","Uyên","Vy","Yến"]
# Muted backgrounds taken from FrontEnd/static/css/app.css palette
BACKGROUNDS = ["#e9eee8", "#f2eadc", "#e3ece2", "#efe6dc", "#e8ebe4", "#f3e4df"]
# Calm, readable expressions for a deduction game (no monster/rage faces)
EXPRESSIONS = ["awe", "blank", "calm", "cheeky", "concerned", "cute", "driven",
               "explaining", "lovingGrin1", "serious", "smile", "smileBig",
               "solemn", "suspicious", "tired"]
DISABLED = {"mask", "facialHair"}

def slug(name):
    s = "".join(c for c in unicodedata.normalize("NFD", name) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("đ", "d")).strip("-")

class Rng:
    def __init__(self, seed): self.seed, self.n = seed, 0
    def int(self, k):
        self.n += 1
        h = hashlib.sha256(f"{self.seed}:{self.n}".encode()).digest()
        return int.from_bytes(h[:8], "big") % k
    def pick(self, seq): return seq[self.int(len(seq))]

def render(elements, ctx):
    out = []
    for el in elements:
        t = el["type"]
        if t == "component":
            variant = ctx["parts"].get(el["name"])
            if variant is None: continue
            attrs = "".join(f" {k}={quoteattr(str(v))}" for k, v in el.get("attributes", {}).items())
            inner = render(DATA["components"][el["name"]]["variants"][variant]["elements"], ctx)
            out.append(f"<g{attrs}>{inner}</g>")
        elif t == "element":
            attrs = ""
            for k, v in el.get("attributes", {}).items():
                if isinstance(v, dict) and v.get("type") == "color": v = ctx["colors"][v["name"]]
                attrs += f" {k}={quoteattr(str(v))}"
            kids = render(el.get("children", []), ctx)
            out.append(f"<{el['name']}{attrs}>{kids}</{el['name']}>" if kids else f"<{el['name']}{attrs}/>")
    return "".join(out)

def build(name):
    rng = Rng(name)
    colors = {k: rng.pick(v["values"]) for k, v in DATA["colors"].items()}
    parts = {}
    for comp, spec in DATA["components"].items():
        if comp in DISABLED: continue
        if rng.int(100) >= spec.get("probability", 100): continue
        parts[comp] = rng.pick(EXPRESSIONS if comp == "expression" else [v for v in spec["variants"] if v not in ("hijab", "bear")])
    bg = rng.pick(BACKGROUNDS)
    body = render(DATA["canvas"]["elements"], {"colors": colors, "parts": parts})
    # 4:5 crop so the 46x57 portrait slot shows head and shoulders
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="72 0 560 700" fill="none" '
            f'shape-rendering="auto" role="img" aria-label={quoteattr(name)}>'
            f'<rect x="72" y="0" width="560" height="700" fill="{bg}"/>{body}</svg>'), parts

for n in NAMES:
    svg, parts = build(n)
    (OUT / f"{slug(n)}.svg").write_text(svg, "utf-8")
    print(slug(n), parts)
