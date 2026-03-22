#!/usr/bin/env python3
"""
Print the font family names embedded in a TTF/OTF file.
Usage: python3 scripts/check-font-name.py typst/fonts/<file>.ttf
"""

import struct
import sys


def read_name_table(path: str) -> dict[int, str]:
    with open(path, "rb") as f:
        data = f.read()

    num_tables = struct.unpack_from(">H", data, 4)[0]
    tables: dict[str, tuple[int, int]] = {}
    for i in range(num_tables):
        base = 12 + i * 16
        tag = data[base : base + 4].decode("ascii")
        offset, length = struct.unpack_from(">II", data, base + 8)
        tables[tag] = (offset, length)

    if "name" not in tables:
        return {}

    off = tables["name"][0]
    count = struct.unpack_from(">H", data, off + 2)[0]
    string_off = struct.unpack_from(">H", data, off + 4)[0]

    names: dict[int, str] = {}
    for i in range(count):
        pid, eid, lid, nid, length, voff = struct.unpack_from(
            ">HHHHHH", data, off + 6 + i * 12
        )
        raw = data[off + string_off + voff : off + string_off + voff + length]
        try:
            s = raw.decode("utf-16-be") if pid == 3 else raw.decode("latin-1")
            names[nid] = s
        except Exception:
            pass

    return names


def main() -> None:
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <font-file>")
        sys.exit(1)

    path = sys.argv[1]
    names = read_name_table(path)

    family = names.get(1, "(not found)")
    preferred = names.get(16, "(same as family)")
    full = names.get(4, "(not found)")

    print(f"File           : {path}")
    print(f"Family (ID 1)  : {family}")
    print(f"Preferred (ID 16): {preferred}")
    print(f"Full name (ID 4) : {full}")
    print()
    print(f'Use in Typst   : font: ("{preferred if preferred != "(same as family)" else family}", ...)')


if __name__ == "__main__":
    main()
