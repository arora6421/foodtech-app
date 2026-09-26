"""Subset the app's fonts to WOFF2 (M1.7).

    python scripts/subset-fonts.py

Sources: the full OFL fonts in docs/design/fonts/ (the one copy in the repo).
Output:  src/app/design/fonts/*.woff2, the only font files the app ships.

What is kept:
  * characters: every non-ASCII character in text that can reach the screen (the app's copy,
    catalogue, CSS and HTML, with comments and debug-only code skipped), plus Basic Latin,
    Latin-1 and common punctuation as a safety margin, so a new dish name with an accent still
    renders. Re-run this script if the catalogue gains characters from a new script;
  * variable axes the design uses: Fraunces weight 300–700 with its full optical size, SOFT and
    WONK ranges; Instrument Sans weight 400–700 with width pinned at 100 (never varied);
  * OpenType features: the defaults (kerning, ligatures, marks) plus rvrn (Fraunces' required
    variation alternates), tnum (tabular figures for prices and times) and case.
"""
import pathlib
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "design" / "fonts"
OUT = ROOT / "src" / "app" / "design" / "fonts"

FONTS = [
    ("Fraunces.ttf", "Fraunces.woff2", {"wght": (300, 700)}),
    ("Fraunces-Italic.ttf", "Fraunces-Italic.woff2", {"wght": (300, 700)}),
    ("InstrumentSans.ttf", "InstrumentSans.woff2", {"wdth": 100, "wght": (400, 700)}),
]

# Safety margin: Basic Latin, Latin-1 Supplement, and punctuation/symbols the UI uses or may use.
BASE = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100))
BASE |= {ord(c) for c in "‘’‚“”„–—…•·′″‹›€£→←↑↓✓✕×−"}

BLOCK_COMMENTS = re.compile(r"/\*.*?\*/|<!--.*?-->", re.S)
LINE_COMMENTS = re.compile(r"(^|[^:'\"`])//[^\n]*")  # `//` not preceded by ':' so URLs survive
ESCAPES = re.compile(r"\\u\{?([0-9a-fA-F]{4,5})\}?")


def used_characters() -> set[int]:
    found = set()
    patterns = ["src/app/**/*.ts", "src/app/**/*.tsx", "src/app/**/*.css", "src/catalog/**/*.ts", "src/domain/**/*.ts", "index.html"]
    for pattern in patterns:
        for path in ROOT.glob(pattern):
            if ".test." in path.name or "debug" in path.parts or "testing" in path.parts:
                continue
            text = path.read_text(encoding="utf-8")
            text = BLOCK_COMMENTS.sub("", text)
            text = LINE_COMMENTS.sub(lambda m: m.group(1), text)
            text = ESCAPES.sub(lambda m: chr(int(m.group(1), 16)), text)
            found |= {ord(c) for c in text if ord(c) > 0x7E}
    return found


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    unicodes = sorted(BASE | used_characters())
    extra = [f"U+{u:04X} {chr(u)!r}" for u in unicodes if u not in BASE]
    print(f"{len(unicodes)} code points ({len(extra)} beyond the base set): {', '.join(extra)}")
    OUT.mkdir(parents=True, exist_ok=True)
    for src_name, out_name, limits in FONTS:
        before = (SRC / src_name).stat().st_size
        font = TTFont(SRC / src_name, lazy=False)
        options = subset.Options()
        options.layout_features = subset.Options().layout_features + ["rvrn", "tnum", "case"]
        options.name_IDs = ["*"]
        options.name_languages = ["*"]
        options.notdef_outline = True
        options.hinting = False  # TrueType hints add weight; modern renderers ignore them for variable fonts
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=unicodes)
        subsetter.subset(font)
        font = instancer.instantiateVariableFont(font, limits)  # after subsetting: less to process
        font.flavor = "woff2"
        font.save(OUT / out_name)
        after = (OUT / out_name).stat().st_size
        print(f"{src_name:22} {before / 1024:7.1f} KB  ->  {out_name:24} {after / 1024:6.1f} KB  ({font['maxp'].numGlyphs} glyphs)")


if __name__ == "__main__":
    main()
