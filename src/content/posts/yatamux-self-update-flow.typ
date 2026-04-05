#import "./_diagram.typ": accent-node, soft-node, note-node, code-node, column, row, down, centered

#let diagram() = centered(column(
  note-node("stable release only", "prerelease は更新対象外"),
  down(label: "GitHub Releases API"),
  accent-node("latest release を取得"),
  down(label: "assets"),
  row(
    code-node("yatamux.exe"),
    code-node("checksums.txt"),
  ),
  down(label: "download + verify"),
  note-node("parse_release_info()", "extract_checksum()", "verify_checksum()"),
  down(),
  soft-node("yatamux.exe.new", "として保存"),
  down(label: "IPC"),
  accent-node("SaveAndQuit"),
  note-node("セッション保存付きで終了"),
  down(label: "helper mode"),
  code-node("--apply-update", "<pid> <new_path>"),
  down(label: "wait for PID"),
  row(
    code-node(".bak に退避"),
    soft-node("exe を差し替え"),
  ),
  down(),
  accent-node("再起動"),
  note-node("session.toml を復元"),
))
