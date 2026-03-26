---
title: "型・トレイト関係図"
order: 5
description: "全クレートにわたる struct / enum / trait の依存関係を一枚で俯瞰する。"
---

この章を書いていて、普段何気なく使っている型名が、実際に図に起こすと意外な依存関係を持っていることに改めて気づいた。特に `Grid` がサーバーとクライアントの唯一の共有状態であることは、設計の根幹なのに言語化するまで意識できていなかった。

## この章の読み方

この章は開発中の型検索・依存関係確認のためのリファレンス。初読の場合は章末の**型間の所有・参照関係**と**メッセージフロー要約**を先に確認してから各クレートの定義に戻ると全体像が掴みやすい。

## クレート別 型一覧

### yatamux-protocol

プロジェクト全体の共通語彙。他のクレートはすべてここに依存する。ロジックを持たない。設計中、メッセージ型の数が増えるにつれて「これは protocol に置くべきか server にローカルで置くべきか」の境界線を何度も引き直した。最終的に「wire を流れる型だけ protocol に入れる」という基準に落ち着いた。

```
WorkspaceId(u32)
SurfaceId(u32)
PaneId(u32)
TermSize { rows: u16, cols: u16 }
SplitDirection { Horizontal | Vertical }
PaneInfo { id, title, size, surface }

ClientMessage (enum, serde)
  +-- CreateWorkspace { name }
  +-- CreateSurface { workspace }
  +-- CreatePane { surface, split_from, direction, size, working_dir }
  +-- Input { pane, data }
  +-- Resize { pane, size }
  +-- ClosePane { pane }
  +-- RequestScreen { pane }
  +-- ListPanes
  \-- CapturePane { pane, lines }

ServerMessage (enum, serde)
  +-- WorkspaceCreated { id, name }
  +-- SurfaceCreated { id, workspace }
  +-- PaneCreated { id, surface, split_from?, direction? }
  +-- Output { pane, data: Arc<[u8]> }   <- Arc でコピーレスファンアウト
  +-- TitleChanged { pane, title }
  +-- Notification { pane, body }
  +-- ClipboardWrite { pane, data }
  +-- PaneClosed { pane }
  +-- Error { message }
  +-- PanesListed { panes }
  \-- PaneContent { pane, content }
```

### yatamux-terminal

Win32 依存なし。PTY・VT パーサ・グリッドをカプセル化する。詳細は [03章 レンダリングパイプライン](./03-rendering)。

```
PtyHandle (trait)                       <- 抽象化レイヤ
  fn write(&mut self, &[u8]) -> Result
  fn resize(&self, TermSize) -> Result
  fn take_killer() -> Option<ProcessKiller>
  fn take_exit_waiter() -> Option<ExitWaiter>

PtySession                              <- PtyHandle の本番実装（ConPTY）
  writer: Box<dyn Write + Send>
  master: Box<dyn MasterPty + Send>
  child: Option<Box<dyn Child + Send + Sync>>

ProcessKiller(Box<dyn FnOnce + Send + Sync>)
  fn kill(self)

ExitWaiter(Box<dyn FnOnce + Send>)
  fn wait(self)

CjkWidthConfig                          <- East Asian Ambiguous 幅設定

Grid
  cells: Vec<Vec<Cell>>
  dirty: Vec<bool>                      <- 行単位の再描画フラグ
  scrollback: ScrollbackBuffer
  cursor: CursorPos
  flags: GridFlags                      <- DECAWM / LCF / カーソル表示 等

ScrollbackBuffer
  rows: VecDeque<Vec<Cell>>
  max_rows: usize                       <- 上限 50,000 行

Cell
  content: CellContent
  style: CellStyle

CellContent (enum)
  +-- Grapheme { ch: String, width: u8 }
  +-- Continuation                      <- 全角右側ダミー
  \-- Empty

CellStyle { fg, bg, bold, italic, underline, ... }
Color { Rgb(r,g,b) | Indexed(u8) | Default }

VtProcessor<'a>
  grid: &'a mut Grid
  current_style: CellStyle
  title: Option<String>
  notification: Option<String>
  clipboard_data: Option<Vec<u8>>
  command_finished: bool
  bell: bool
  -> impl vte::Perform              <- vte クレートのコールバック実装
```

### yatamux-server

セッション階層とペインライフサイクルを管理する。詳細は [04章 ペイン管理](./04-pane-management)。

```
Workspace
  id: WorkspaceId
  name: String
  surfaces: Vec<Surface>

Surface
  id: SurfaceId
  workspace: WorkspaceId
  tree: PaneTree

PaneTree (enum, サーバーローカル型)
  +-- Leaf(PaneId)
  \-- Node { direction, ratio: f32, left: Box<PaneTree>, right: Box<PaneTree> }

Server
  workspaces: Vec<Workspace>
  panes: HashMap<PaneId, Pane>
  rx: mpsc::Receiver<ClientMessage>
  tx: mpsc::Sender<ServerMessage>

Pane
  id: PaneId
  grid: Arc<tokio::Mutex<Grid>>           <- VtProcessor が更新
  output_tx: mpsc::Sender<(PaneId, Arc<[u8]>)>
  cmd_tx: mpsc::Sender<PtyCmd>            <- Input / Resize コマンド
  title: Arc<std::Mutex<String>>          <- std:: を使う（T-01 参照）
  size: Arc<std::Mutex<TermSize>>
  child_killer: Option<ProcessKiller>     <- Drop 時に kill()

PtyCmd (enum, クレート内部)
  +-- Input(Vec<u8>)
  \-- Resize(TermSize)
```

### yatamux-renderer

デバッグ用のテキストレンダラー。将来的に wgpu による GPU レンダリングへの移行を見据えたクレートとして分離している。現時点ではデバッグ描画のみ実装。分離の意図は [01章 クレート分割](./01-overview#クレート分割)。

```
TextRenderer
  fn render_text(&self, text: &str, x: i32, y: i32)
```

### yatamux-client

Win32 ウィンドウ・レンダリング・UI 状態を管理する。詳細は [03章 GDI 描画](./03-rendering#gdi-描画) / [04章 ペイン管理](./04-pane-management)。

```
ClientState                              <- Win32 スレッドと tokio が共有
  store: Arc<Mutex<PaneStore>>
  msg_tx: mpsc::Sender<ClientMessage>
  split_tx: mpsc::Sender<(PaneId, SplitDirection)>
  float_tx: mpsc::Sender<()>
  active_toasts: Mutex<Vec<Toast>>

PaneStore
  grids: HashMap<PaneId, Arc<Mutex<Grid>>>
  layout: LayoutNode                      <- クライアント側レイアウトツリー
  active: PaneId
  pending_clipboard: Option<Vec<u8>>
  pending_toasts: VecDeque<Toast>
  scroll_offset: usize
  floating: Option<PaneId>
  floating_visible: bool
  launcher: Option<LauncherState>
  copy_mode: Option<CopyState>

LayoutNode (enum, クライアントローカル型)
  +-- Leaf(PaneId)
  \-- Split { direction, ratio: f32, first: Box<LayoutNode>, second: Box<LayoutNode> }

PaneRect { x, y, width, height: i32 }   <- compute_rects() の出力

Toast
  body: String
  created_at: Instant
  phase: ToastPhase                      <- SlideIn / Visible / FadeOut

LauncherState
  layouts: Vec<String>
  selected: usize

CopyState
  cursor: (usize, usize)
  selection: Option<((usize,usize),(usize,usize))>
```

## 型間の所有・参照関係

```
Server
  \-- HashMap<PaneId, Pane>
        \-- Arc<tokio::Mutex<Grid>>  ---------------------+
                                                          | Arc::clone
ClientState                                               |
  \-- Arc<Mutex<PaneStore>>                               |
        \-- HashMap<PaneId, Arc<tokio::Mutex<Grid>>> -----+
            (同じ Grid インスタンスをサーバーとクライアントが共有)
```

`Grid` は `Arc<tokio::Mutex<_>>` でサーバーとクライアントが共有する唯一の共有状態。
それ以外の通信はすべて `mpsc` チャネル経由で行う。

## PtyHandle トレイトの差し込み構造

```
                        +--------------+
                        |  PtyHandle   | (trait)
                        |  write()     |
                        |  resize()    |
                        |  take_killer |
                        |  take_exit_w |
                        +------+-------+
               (本番)          |           (テスト)
         +-------------+       |       +------------------+
         | PtySession  |       |       | MockPty          |
         | (ConPTY)    |-------+       | (mpsc channel)   |
         +-------------+               +------------------+
                v                               v
         Pane::spawn()                  Pane::spawn_with_handle()
```

`Pane::spawn_with_handle<P: PtyHandle>()` を使うことで、
テストは ConPTY を起動せずにサーバー層を完全に検証できる。

## メッセージフロー要約

```
Win32 WndProc
  |  WM_CHAR / WM_KEYDOWN
  |  -> ClientMessage::Input         msg_tx
  |  -> (PaneId, SplitDirection)     split_tx
  |  -> ()                           float_tx
  v
app.rs select! loop
  |  ClientMessage -> merged_tx -> Server::run()
  |
  v ServerMessage <----------------------------+
ClientState / PaneStore update                 |
  |                                   Server::run()
  |  Arc<Mutex<Grid>> ref              |
  v                                   | Pane x N
WM_PAINT -> paint()                   |   PTY read task
  GDI rendering                       |   -> vte::Parser
                                      |   -> VtProcessor
                                      |   -> Grid update (dirty=true)
                                      |   -> output_tx.send(raw_bytes)
                                      \--> ServerMessage::Output
```
