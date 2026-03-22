#!/usr/bin/env python3
"""
Compile .typ files and detect font name mismatches against typst/fonts/.

Exit 0  — no issues (system fonts absent on CI are reported but not fatal)
Exit 1  — a font that should be served from typst/fonts/ is unknown,
          indicating a family-name mismatch between the TTF and the source
          (e.g. "HackGen Console NF" in source but TTF provides "HackGen Console")

Usage:
    python3 scripts/check-fonts.py
"""
from __future__ import annotations

import re
import struct
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = ROOT / "typst" / "fonts"


# ---------------------------------------------------------------------------
# TTF name-table reader
# ---------------------------------------------------------------------------

def _read_name_table(data: bytes) -> dict[int, str]:
    num_tables = struct.unpack_from(">H", data, 4)[0]
    tables: dict[str, tuple[int, int]] = {}
    for i in range(num_tables):
        base = 12 + i * 16
        tag = data[base : base + 4].decode("ascii", errors="ignore")
        offset, length = struct.unpack_from(">II", data, base + 8)
        tables[tag] = (offset, length)
    if "name" not in tables:
        return {}
    off = tables["name"][0]
    count = struct.unpack_from(">H", data, off + 2)[0]
    str_off = struct.unpack_from(">H", data, off + 4)[0]
    names: dict[int, str] = {}
    for i in range(count):
        pid, _eid, _lid, nid, length, voff = struct.unpack_from(
            ">HHHHHH", data, off + 6 + i * 12
        )
        raw = data[off + str_off + voff : off + str_off + voff + length]
        try:
            s = raw.decode("utf-16-be") if pid == 3 else raw.decode("latin-1")
            names.setdefault(nid, s)
        except Exception:
            pass
    return names


def project_font_families() -> set[str]:
    """Return lowercased family names of all TTF/OTF files in typst/fonts/."""
    families: set[str] = set()
    for f in FONTS_DIR.glob("*"):
        if f.suffix.lower() not in (".ttf", ".otf"):
            continue
        names = _read_name_table(f.read_bytes())
        # nameID 16 (preferred family) takes precedence over nameID 1 (family)
        for nid in (16, 1):
            if nid in names:
                families.add(names[nid].lower())
                break
    return families


# ---------------------------------------------------------------------------
# Typst compilation
# ---------------------------------------------------------------------------

_WARN_RE = re.compile(r"unknown font family: (.+)$")

# Files to compile with their extra CLI arguments.
# Paths are relative to ROOT/typst/.
_TARGETS: list[tuple[str, list[str]]] = [
    (
        "og_images/og-page.typ",
        ["--input", "title=Font Check", "--input", "description=", "--input", "kind=Test"],
    ),
    ("og_images/og.typ", []),
]


def _collect_targets() -> list[tuple[str, list[str]]]:
    targets = list(_TARGETS)
    for f in sorted((ROOT / "typst").glob("*.typ")):
        targets.append((f.name, []))
    return targets


def compile_warnings(targets: list[tuple[str, list[str]]]) -> dict[str, list[str]]:
    """Return {label: [unknown_font_name, ...]} for each compiled file."""
    result: dict[str, list[str]] = defaultdict(list)
    with tempfile.TemporaryDirectory() as tmpdir:
        for label, extra in targets:
            safe = label.replace("/", "_").replace(".typ", "")
            is_image = "og_images" in label
            outfile = Path(tmpdir) / (safe + (".png" if is_image else ".pdf"))
            fmt = ["--format", "png" if is_image else "pdf"]
            cmd = (
                ["typst", "compile", "--font-path", str(FONTS_DIR)]
                + fmt
                + extra
                + [str(ROOT / "typst" / label), str(outfile)]
            )
            proc = subprocess.run(
                cmd, capture_output=True, text=True, encoding="utf-8", errors="replace"
            )
            for line in ((proc.stdout or "") + (proc.stderr or "")).splitlines():
                m = _WARN_RE.search(line)
                if m:
                    result[label].append(m.group(1).strip())
    return result


# ---------------------------------------------------------------------------
# Mismatch detection
# ---------------------------------------------------------------------------

def is_project_font_mismatch(unknown: str, project_fonts: set[str]) -> bool:
    """
    True when `unknown` looks like a typo/variant of a font we provide.

    Example:
        unknown = "hackgen console nf",  project = {"hackgen console"}
        → "hackgen console nf".startswith("hackgen console") → True → mismatch
    """
    u = unknown.lower()
    for pf in project_fonts:
        if u.startswith(pf) or pf.startswith(u):
            return True
    return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    pf = project_font_families()
    print(f"Project fonts (typst/fonts/): {sorted(pf)}")
    print()

    targets = _collect_targets()
    warnings_by_file = compile_warnings(targets)

    failed = False
    for label, _ in targets:
        unknowns = warnings_by_file.get(label, [])
        mismatches = [f for f in unknowns if is_project_font_mismatch(f, pf)]
        system_absent = [f for f in unknowns if not is_project_font_mismatch(f, pf)]

        if mismatches:
            print(f"[NG] {label}")
            for font in mismatches:
                msg = f'unknown font family: "{font}" — file in typst/fonts/ but name mismatch'
                print(f"     {msg}")
                print(f"::error file=typst/{label}::{msg}")
            failed = True
        elif system_absent:
            # System fonts not present on CI — not our responsibility
            print(f"[OK] {label}  (system fonts absent on CI: {system_absent})")
        else:
            print(f"[OK] {label}")

    print()
    if failed:
        print("::error::Font name mismatch(es) detected.")
        print("::error::Run: python3 scripts/check-font-name.py typst/fonts/<file>.ttf")
        print("::error::to verify the embedded family name and update your .typ source.")
        return 1

    print("All font checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
