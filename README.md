# NTUT FA Quest

以「有限自動機」驗證行政流程的校園大地遊戲。玩家在 2D 像素風校園地圖中移動、尋找 NPC 完成文件申請任務，遊戲會把玩家實際操作記錄成一串 Trace，交由 DFA / NFA 驗證是否符合合法流程，並顯示 ACCEPT / REJECT。

完整專題動機、設計與開發規劃請見 [NTUT-FA-Quest-計畫書.md](NTUT-FA-Quest-計畫書.md)。

## 目前完成度

本專案採漸進式開發，目前完成的部分：

- 校園地圖、玩家與 NPC 的像素風 2D 呈現（類似 Pokemon / RPG Maker 的 tile-based 呈現方式）
- 玩家移動（格子鎖定 + 平滑補間）、攝影機跟隨、NPC 碰撞
- 靠近 NPC 互動、對話框顯示

尚未串接（僅有骨架檔案，見 `src/automata/`、`src/verification/`、`src/quest/`）：

- Quest 系統、時間系統、體力系統的實際邏輯
- DFA / NFA 模擬與 Verification Engine（Trace 記錄、ACCEPT / REJECT、Counterexample）

## 下載與執行

需要 [Node.js](https://nodejs.org/)（建議 18 以上版本）。

```bash
git clone https://github.com/AnHsi0714/ntut-fa-quest.git
cd ntut-fa-quest
npm install
npm run dev
```

啟動後依終端機顯示的網址（預設 http://localhost:5173）用瀏覽器開啟即可遊玩。

其他指令：

```bash
npm run build    # 建置生產版本到 dist/
npm run preview  # 預覽建置後的版本
```

## 遊戲操作

| 操作 | 按鍵 |
| --- | --- |
| 移動 | 方向鍵 或 WASD |
| 與面前的 NPC 互動 / 關閉對話框 | Enter 或 Space |

## 技術棧

TypeScript + Vite，畫面以 Canvas 2D 繪製像素圖塊與角色，不使用外部美術素材（角色與地圖圖塊皆為程式產生的像素圖），不依賴後端或資料庫。

## 專案架構

```
src/
├── game/          地圖、玩家、NPC、像素美術、輸入、攝影機、對話框
├── quest/         任務資料與管理（骨架）
├── automata/       DFA / NFA 資料結構（骨架）
├── verification/  Verification Engine、Trace、Counterexample（骨架）
└── ui/            Quest / Verification / Automaton 顯示面板（骨架）
```
