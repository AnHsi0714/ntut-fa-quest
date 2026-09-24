# NTUT FA Quest：以有限自動機進行行政流程驗證的校園大地遊戲

> GitHub Repository 建議名稱：**`ntut-fa-quest`**
> （FA = Finite Automata，比原本的 `ntut-doc-game` 更能反映專題的形式語言 / 自動機核心，長度也維持簡短好記）

---

## 1. 專題概述

本專題將國立臺北科技大學的校園行政文件申請流程轉化為一個輕量化的 2D Web 大地遊戲。

玩家需要在校園地圖中移動，依序尋找不同的 NPC、辦公室與行政單位，完成文件申請任務。不同文件具有不同的申請流程，玩家實際執行的行為會被記錄成一串操作序列，再交由有限自動機進行驗證。

專題將遊戲中的任務流程與課堂所學的 Regular Language、DFA、NFA 與 Formal Verification 結合，讓原本抽象的自動機理論能夠透過遊戲中的實際操作呈現。

---

## 2. 專題動機

作者在實際申請校內文件時，經常需要在不同的辦公室、老師與行政單位之間往返，有些文件還需要按照特定順序完成簽核或申請。

整個過程有時就像在校園裡進行一場「大地遊戲」：

```
先去找老師
    ↓
再去系辦
    ↓
再去其他行政單位
    ↓
發現承辦人不在
    ↓
之後再跑回來
    ↓
繼續下一個流程
```

因此，本專題希望將這種實際經驗轉化成遊戲，讓玩家透過在校園中探索與完成任務，體驗類似大地遊戲的行政文件申請流程。

同時結合課堂所學的 Formal Language、Finite Automata 與 Software Verification，將每個行政流程抽象成有限狀態模型，並利用 DFA 或 NFA 判斷玩家實際執行的流程是否符合規定。

藉由這種方式，可以將課堂上的理論概念與實際的軟體系統結合，讓「一連串的行政行為」轉換成可以被驗證的 execution trace。

---

## 3. 專題目標

### 3.1 遊戲目標

- [x] 建立簡單的 NTUT 校園 2D 地圖
- [x] 建立玩家移動系統
- [x] 建立可互動 NPC
- [x] 建立行政文件申請任務
- [x] 建立任務進度顯示
- [ ] 建立校園探索與文件申請流程
- [x] 建立時間系統（見第 9 節）
- [x] 建立體力與臨時任務系統（見第 9 節）

### 3.2 軟體驗證目標

- [x] 將行政流程抽象成有限狀態模型
- [x] 使用 DFA 表示固定的行政流程
- [ ] 使用 NFA 表示具有多條合法路徑的流程
- [ ] 使用 PDA 表示需要用堆疊記錄配對數量的流程(加退選案例，見第 13A 節)
- [ ] 使用 DFA Minimization 合併行為相同的狀態(任一位老師簽名皆可案例，見第 13B 節)
- [x] 記錄玩家實際操作序列
- [x] 建立 Verification Engine
- [x] 驗證玩家 Trace 是否符合流程
- [x] 顯示 ACCEPT / REJECT
- [x] 顯示錯誤流程與 Invalid Transition
- [x] 建立 Counterexample

> 目前自動機理論部分以課堂已學過的 **DFA / NFA** 為核心範疇。若後續課程進度延伸到 Minimization、正規表達式等內容，會視情況評估是否加入延伸應用；本計畫書先以「邊實作、邊視學習進度擴充」為原則，不預先塞入尚未學過的理論。
>
> **後續規劃(已確認方向)：** 課程進度進入 Context-Free Languages / PDA 單元後，預計加入「加退選」案例作為 PDA 的延伸應用(詳見第 13A 節)，用來示範需要用堆疊記錄配對數量的流程，這種情境是 DFA / NFA 無法處理的。

---

## 4. 核心概念

整個系統分成三個部分：

```
┌─────────────────────────┐
│       Web RPG Layer     │
│                         │
│ Map / Player / NPC      │
│ Quest / Dialogue        │
└────────────┬────────────┘
             │
             │ Player Events
             ▼
┌─────────────────────────┐
│   Verification Layer    │
│                         │
│ DFA / NFA               │
│ Verification Engine     │
└────────────┬────────────┘
             │
             ▼
      ACCEPT / REJECT
```

玩家在遊戲中的行為，例如：

```
VisitAdvisor
VisitDepartmentOffice
VisitAcademicAffairs
```

會形成一個 Trace：

```
VisitAdvisor
→ VisitDepartmentOffice
→ VisitAcademicAffairs
```

Verification Engine 再判斷這個 Trace 是否屬於合法流程。

**設計原則（重要）：** Verification Engine 採「事後驗證」而非「即時攔截」。玩家在地圖上永遠可以物理移動到任何 NPC 所在位置、也可以嘗試互動，遊戲**不會**阻止玩家走錯路。每次互動觸發 Event 時，Engine 會即時檢查目前 state 是否存在對應的 transition；若不存在，該步驟標記為 Invalid Transition，最終結算時顯示 REJECT 並附上 Counterexample。這個設計讓玩家可以「故意走錯」來體驗驗證失敗的過程，也更貼近真實情境中「你當然可以跑錯地方，只是流程不會過」的感覺。

---

## 5. 遊戲設計

### 5.1 遊戲形式

- [ ] 2D Top-down Web Game
- [ ] 單人遊戲
- [ ] 校園探索
- [ ] 任務導向
- [ ] NPC 互動
- [ ] 無戰鬥系統
- [ ] 無角色養成系統

本專題重點是「流程驗證」，因此不將開發時間花在戰鬥、裝備、角色等 RPG 系統。

---

## 6. 校園地圖

第一版只建立專題所需要的部分校園環境，不需要完整重現整個 NTUT。

預計包含：

- [x] 系辦
- [x] 教務處
- [x] 系主任辦公室
- [x] 承辦老師所在位置
- [x] 校園道路
- [x] 廣場
- [ ] 其他必要地點（例如餐廳 / 教室，供第 9 節臨時任務使用）

- [ ] 目前 MVP 版本的地圖（`campusMapData.ts`）刻意做得很小，只夠放下現有幾個地點。後續要把地圖尺寸拉大、做出真正有探索感的校園規模，不要一直維持這種小地圖。

例如：

```
                ┌──────────────┐
                │    教務處     │
                └──────┬───────┘
                       │
          ┌────────────┴────────────┐
          │                         │
    ┌─────▼─────┐             ┌─────▼─────┐
    │    系辦    │             │  系主任室  │
    └─────┬─────┘             └───────────┘
          │
    ┌─────▼─────┐
    │  校園廣場  │
    └───────────┘
```

---

## 7. NPC 設計

預計建立：

- [x] 承辦老師 NPC（固定時段出現型，見第 9 節）
- [x] 系辦 NPC
- [x] 系主任 NPC（遊走 / 隨機出現型，見第 9 節）
- [x] 教務處 NPC
- [ ] 其他輔助 NPC

NPC 可以提供：

- [ ] 任務資訊
- [ ] 文件申請資訊
- [ ] 流程提示
- [ ] 文件或道具
- [ ] 任務完成確認
- [ ] 人員是否在場的狀態

---

## 8. 文件任務

第一版預計選擇 3～5 個實際校園行政文件流程。

> **資料來源與免責聲明：** 實際流程以學校當年度官方規定為準（例如教務處網站公告、系辦公告等），遊戲中的流程會進行必要簡化，不取代正式行政資訊。開發時須於文件任務設計文件（或 `questData.json` 註解）中**明確記錄每個流程的資料來源網址與查詢日期**，避免日後校方流程異動造成資訊誤導；遊戲內也應加註「流程僅供示意，正式申請請以教務處 / 系辦公告為準」的提示文字。

### 文件 A

例如：

```
承辦老師
    ↓
系辦
    ↓
教務處
```

玩家需要：

- [ ] 找到承辦老師
- [ ] 完成承辦老師階段
- [ ] 前往系辦
- [ ] 完成系辦階段
- [ ] 前往教務處
- [ ] 完成文件申請

### 文件 B

例如：

```
承辦老師
    ↓
系辦
    ↓
系主任
    ↓
教務處
```

玩家若跳過系辦直接前往系主任：

```
承辦老師
    ↓
系主任
```

則驗證系統應判定：

```
REJECT
```

### 文件 C(加退選，PDA 案例)

情境：學生的學分已達上限，想加選新的課，必須先退掉課才能加選。退選與加選的順序不限，但累積退選次數必須隨時大於等於累積加選次數，最後兩者要完全打平，才能送出選課申請。

玩家可以：

- [ ] 退選一門課（DropCourse）
- [ ] 加選一門課（AddCourse），僅在目前還有可用名額時合法
- [ ] 送出選課申請（SubmitCourseRequest），僅在退選與加選數量完全打平時合法

範例（合法，先退後加）：

```
DropCourse → DropCourse → AddCourse → AddCourse → SubmitCourseRequest
```

範例（合法，順序交錯）：

```
DropCourse → AddCourse → DropCourse → AddCourse → SubmitCourseRequest
```

範例（非法，加選超過目前可用名額）：

```
DropCourse → AddCourse → AddCourse → SubmitCourseRequest
```

第二次 AddCourse 發生當下沒有可配對的名額，直接判定為 Invalid Transition。

這個流程無法只用 DFA / NFA 表示，因為合法與否取決於「目前累積退了幾門還沒配對」，這個數量沒有上限，需要用堆疊來記錄。詳見第 13A 節。

### 文件 D(任一位老師簽名皆可，Minimization 案例)

情境：某張申請表，可以找 (A) 導師、(B) 系學會指導老師，或 (C) 系上任一位老師簽名，三選一即可，簽好之後不論是哪一位簽的，後續流程都一樣：送到系辦，然後完成。

玩家可以：

- [ ] 找任一位授權老師簽名(三選一)
- [ ] 送到系辦
- [ ] 完成申請

範例(三種簽名人皆合法，後續流程完全相同)：

```
SignByAdvisor → SubmitToOffice → CompleteQuest
```

```
SignByClubAdvisor → SubmitToOffice → CompleteQuest
```

```
SignByTeacher → SubmitToOffice → CompleteQuest
```

這份文件的流程本身很單純，設計重點不在能不能通過驗證，而是示範一件事：先用 NFA 畫出三條平行分支(甲/乙/丙任一位簽名)，轉成 DFA 後會產生三個分別對應「甲簽好了」「乙簽好了」「丙簽好了」的狀態；但因為這三個狀態之後能走的路完全一樣(都只剩送到系辦這一條路)，可以透過 Minimization 合併成一個狀態。詳見第 13B 節。

---

## 9. 流程例外、時間與體力系統

這是本次計畫修訂的重點之一。為了避免玩家只用「一直去蹲點」這種不真實、也無法測試遊戲節奏的方式破關，本專題引入**時間系統**與**體力 / 臨時任務系統**，讓 NPC 的出現與否跟「什麼時候去找」產生關聯，更貼近真實行政流程中「老師不一定在辦公室」的情境。

### 9.1 NPC 出現方式分類

- **固定時段型**：例如承辦老師只在特定時段（早上 / 下午）在辦公室，玩家可查詢公告或詢問其他 NPC 得知時段，也可以選擇「跳轉時間」直接前進到該時段。
- **遊走 / 隨機型**：例如系主任可能在辦公室，也可能不在（開會、跑班等），出現與否由機率決定，玩家需要靠「碰運氣」多次嘗試，或詢問其他 NPC 取得目前所在地提示。

### 9.2 與自動機模型的分工（重要的設計邊界）

時間與機率**不會**變成 Verification Engine 要處理的新語言結構，而是完全交給 Game Layer 決定：

```
Game Layer（時間 / 機率邏輯）
      │
      │ 決定這次 VisitAdvisor
      │ 究竟觸發 Success 還是 StaffAbsent
      ▼
Event（VisitAdvisor 或 StaffAbsent）
      │
      ▼
Verification Engine（只管：這個 Event 在目前 state 合不合法）
```

也就是說：

- **Game Layer** 負責「這次互動，最終產生的 Event 是什麼」（可能考慮時間、機率、體力等因素）。
- **Verification Layer** 只負責「這個 Event 序列，在自動機上合不合法」，完全不需要知道時間或機率是怎麼算出來的。

這樣兩層分工清楚，不會讓 DFA / NFA 的狀態數因為時間 / 機率而爆炸。

### 9.3 老師不在 → 稍後再來（不建 Waiting State，沿用 REJECT）

原本考慮把「老師不在 → 稍後再來 → 再去一次」定義成自動機上獨立的 **Waiting State**（`Advisor -[StaffAbsent]-> Waiting_Advisor -[ReturnLater]-> Advisor`）。實際接上遊戲、看到 UI 上同時出現 `waiting_advisor` 這種內部 state 名稱、以及「下一步可以是：拜訪承辦老師 或 老師不在，撲空了」這種把敘述句當成可選動作的提示文字後，發現這個設計把單純的「撲空」複雜化了：

- Verifier 對「未定義 transition」本來就會回報 Invalid Transition、把該步記錄進 Trace（`isValid: false`）並產生 Counterexample。「撲空要留下紀錄」這個需求，靠 `StaffAbsent` 對應到一個**沒有定義的 transition**、直接 REJECT 就已經滿足，不需要額外的 state。
- 有了 Waiting State 之後，「下一步可以是」的提示還得額外處理「`staff_absent` / `return_later` 其實跟 `visit_advisor` 是同一個玩家動作」的去重邏輯，這正是被複雜化的訊號。

因此改成：`StaffAbsent` 維持是 Alphabet 裡的事件（見第 10 節），但**不**幫它定義任何 transition；玩家在錯的時段去找老師時，Game Layer 送出 `StaffAbsent`，因為沒有對應 transition 所以 REJECT，state 留在原地（例如仍是 `start`），這筆記錄依然留在 Trace 上，但畫面上換成撲空專屬的提示文案，不會顯示制式的「REJECT（Invalid Transition）」字樣，避免玩家誤以為自己把流程走錯了。老師在場時，直接送出原本就存在的 `VisitAdvisor`，不需要「回到原本 state」的過渡事件。

```
(start)
   │ VisitAdvisor + StaffAbsent（沒有對應 transition）→ REJECT，state 留在 start，Trace 留下這筆記錄
   │
   │ VisitAdvisor（老師這次在場）
   ▼
(advisor)
```

- **非法 Loop 的原則同樣適用在撲空上**：`StaffAbsent` 沒有定義 transition，跟玩家在系辦重複造訪超過流程需要的次數是同一種情況。DFA / NFA 天生只認得有定義的 transition，沒有定義對應路徑時就直接落入 REJECT，不需要特別為「撲空」或「非法重複」建立額外的 state。

開發項目：

- [x] NPC 在場 / 不在場狀態
- [x] 撲空（StaffAbsent）沿用「未定義 transition → REJECT」的預設行為，不建立額外 Waiting State
- [ ] 流程分支
- [x] 非法 Loop（交由「未定義 transition → REJECT」的預設行為處理，不需額外建模）

### 9.4 時間系統

- [x] 建立遊戲內時間軸（例如以節次或時段為單位：早上 / 中午 / 下午 / 晚上）
- [x] 建立「跳轉時間」功能，玩家可主動快轉到下一個時段
- [x] 建立固定時段型 NPC 的出現規則（time-gated availability）
- [x] 建立遊走 / 隨機型 NPC 的出現機率規則
- [ ] 將時間條件綁定到對應的 transition（例如：同一個 `VisitAdvisor` 事件，依時段不同對應到 Success 或 StaffAbsent）
- [x] UI 顯示目前時間 / 時段

### 9.5 體力與臨時任務系統

- [x] 建立體力數值與消耗規則（移動、等待、碰運氣皆消耗體力）
- [x] 建立體力歸零後觸發的臨時任務（例如：吃飯、上課、其他日常事件）
- [x] 臨時任務為**純遊戲層機制**：會消耗遊戲內時間、暫時中斷玩家操作，但**不記錄進 Trace，也不進入 Verification Engine**
- [x] 建立體力恢復規則（例如完成吃飯任務後恢復體力）
- [ ] 測試「玩家無法無限蹲點碰運氣」的遊戲節奏是否合理

---

## 10. Formal Language

### 10.1 Alphabet

將玩家的遊戲行為抽象成有限個事件：

```
VisitAdvisor
VisitDepartmentOffice
VisitDepartmentHead
VisitAcademicAffairs
StaffAbsent
SubmitDocument
CompleteQuest
```

形成：

$$
\Sigma =
\{
VisitAdvisor,
VisitDepartmentOffice,
VisitDepartmentHead,
VisitAcademicAffairs,
StaffAbsent,
SubmitDocument,
CompleteQuest
\}
$$

> 時間 / 機率不進入 Σ，而是作為 Game Layer 決定「觸發哪個 Event」的條件（詳見第 9.2 節），Alphabet 本身維持精簡，避免狀態機爆炸。

---

## 11. DFA

以文件 A 為例：

```
(Start)
    │
    │ VisitAdvisor
    ▼
(Advisor)
    │
    │ VisitDepartmentOffice
    ▼
(DepartmentOffice)
    │
    │ VisitAcademicAffairs
    ▼
(AcademicAffairs)
    │
    │ CompleteQuest
    ▼
(Complete)
```

開發項目：

- [x] 建立 State
- [x] 建立 Alphabet
- [x] 建立 Transition Function
- [x] 建立 Initial State
- [x] 建立 Accepting State
- [x] 實作 DFA Simulation
- [x] 確認撲空（StaffAbsent）沿用未定義 transition → REJECT 的預設行為，不需要額外的 Waiting State（見第 9.3 節）

---

## 12. NFA

當行政流程具有多條合法路徑時，使用 NFA 表示。

例如：

```
                 ┌→ 系辦 ─┐
開始 ────────────┤        ├→ 完成
                 └→ 教務處 ┘
```

代表玩家可以透過不同順序完成流程。

開發項目：

- [x] 建立 NFA 結構
- [x] 建立多條 Transition
- [x] 實作 NFA Simulation
- [x] 處理多個可能狀態
- [x] 測試多條合法 Trace

---

## 13. NFA → DFA

將課堂所學的 NFA to DFA Conversion 實際加入系統。

```
NFA
 │
 │ Subset Construction
 ▼
DFA
```

開發項目：

- [x] 實作 ε-closure（若模型需要）
- [x] 實作 State Set
- [x] 實作 Subset Construction
- [x] 產生 DFA
- [x] 比較 NFA 與 DFA 狀態數
- [x] 驗證 NFA 與 DFA 對相同 Trace 的結果一致

---

## 13A. PDA（下推自動機）：加退選案例（規劃中）

當流程需要記住「目前欠了多少還沒配對」時，DFA / NFA 的固定狀態數無法處理，必須引入堆疊（Stack），也就是 PDA（Pushdown Automaton）。這是本計畫書第 3.2 節提到、確認要做的下一階段延伸應用，對應課程 Context-Free Languages 單元。

### 13A.1 情境

對應第 8 節的文件 C：學生加退選時，退選次數必須隨時大於等於加選次數，兩者最後要完全打平才能送出申請。這跟課堂教的括號配對語言結構相同（退選是左括號、加選是右括號），是典型的上下文無關語言，無法用正規語言（DFA / NFA）表示。

### 13A.2 Alphabet 與 Stack 用途

```
DropCourse           → Stack Push 一個名額標記
AddCourse             → Stack Pop 一個名額標記（Stack 為空時判定為 Invalid Transition）
SubmitCourseRequest   → 僅在 Stack 為空時合法，代表退選與加選已完全打平
```

### 13A.3 與現有架構的關係

沿用第 4 節的分層設計：Game Layer 仍只負責把玩家操作轉成 Event，Verification Engine 這一層多了「查看 Stack 目前內容」的能力，但 ACCEPT / REJECT、Invalid Transition、Counterexample 對外的行為維持不變，不需要重新設計 Verification Engine 的介面。

### 13A.4 開發項目（規劃中，尚未實作）

- [ ] 建立 PDA 資料結構（States、Stack Alphabet、Transition、Stack 操作）
- [ ] 實作 PDA Simulation
- [ ] 將 Stack 狀態接上 Verification Engine 的 Invalid Transition 判定
- [ ] 在 Automaton Viewer 加上 Stack 內容即時顯示
- [ ] 建立合法 Trace 測試（含順序交錯的情況）
- [ ] 建立非法 Trace 測試（加選超過可用名額）
- [ ] 蒐集加退選實際規則（學分上限、退選期限等）並記錄資料來源與查詢日期

---

## 13B. DFA Minimization：任一位老師簽名皆可（規劃中）

當 NFA 的多條分支「擇一即可、之後行為完全相同」時，NFA → DFA 轉換出來的 DFA 會保留這些分支各自對應的狀態，即使它們之後的行為其實一樣。Minimization 就是找出這種「行為上沒有差別」的狀態並合併，得到狀態數最少的等價 DFA。

### 13B.1 情境

對應第 8 節的文件 D：找甲老師、乙老師或丙老師簽名皆可，簽完之後不論找的是誰，後續都只剩「送到系辦」這一條路。

### 13B.2 轉換前後對照

```
NFA → DFA（尚未 Minimize）：
(Start) --SignByAdvisor--> (SignedByA)
(Start) --SignByClubAdvisor--> (SignedByB)
(Start) --SignByTeacher--> (SignedByC)
(SignedByA) --SubmitToOffice--> (Complete)
(SignedByB) --SubmitToOffice--> (Complete)
(SignedByC) --SubmitToOffice--> (Complete)

Minimize 之後：
(Start) --SignByAdvisor / SignByClubAdvisor / SignByTeacher--> (Signed)
(Signed) --SubmitToOffice--> (Complete)
```

SignedByA / SignedByB / SignedByC 這三個狀態合併成一個 Signed，因為它們之後能走的路完全一樣。誰簽的名字仍然保留在玩家的操作紀錄(Trace)裡，只是驗證用的自動機狀態被合併，兩者是分開的東西。

### 13B.3 為什麼這個例子可以合併，文件 B 不行

文件 B 是「兩位老師都要簽、不限順序」，簽了甲之後還欠乙、簽了乙之後還欠甲，這兩個狀態接下來要走的下一步不一樣，自動機必須記得「還欠誰」，不能合併。文件 D 是「找誰簽都一樣，之後都是同一條路」，簽完之後不需要記得「是誰簽的」，才能合併。這個對照可以直接放進報告，說明 Minimization 適用與不適用的界線。

### 13B.4 開發項目（規劃中，尚未實作）

- [ ] 建立文件 D 的 NFA 資料
- [ ] 執行 NFA → DFA 轉換，確認轉換後確實產生 3 個對應狀態
- [ ] 實作 Minimization 演算法(狀態等價判斷 / table-filling)
- [ ] 在 Automaton Viewer 顯示 Minimize 前後的狀態數對照
- [ ] 建立測試：Minimize 前後對相同 Trace 的驗證結果一致

---

## 14. Verification Engine

Verification Engine 是本專題最重要的核心模組。

```
Player Action
      ↓
Game Event
      ↓
Verification Engine
      ↓
Current State
      ↓
Transition
      ↓
Next State
```

例如：

```
Current State:
Advisor

Event:
VisitDepartmentOffice

Next State:
DepartmentOffice
```

**運作原則**（呼應第 4 節）：Engine 不攔截玩家的物理移動，只在 Event 發生當下即時判斷 transition 是否存在；不存在則標記為 Invalid Transition，並持續記錄完整 Trace，直到玩家送出文件或結束任務時才統一結算 ACCEPT / REJECT。

開發項目：

- [x] 建立 Automaton Interface
- [x] 建立 Event System
- [x] 建立 Trace Recorder
- [x] 實作 Transition Check
- [x] 實作 ACCEPT
- [x] 實作 REJECT
- [x] 實作 Invalid Transition
- [x] 實作 Counterexample
- [ ] 確保臨時任務 / 時間跳轉等純遊戲事件不會被誤記錄進 Trace

---

## 15. Trace Verification

合法 Trace：

```
VisitAdvisor
→ VisitDepartmentOffice
→ VisitAcademicAffairs
→ CompleteQuest
```

結果：

```
ACCEPT
```

非法 Trace：

```
VisitAdvisor
→ VisitAcademicAffairs
```

結果：

```
REJECT
```

系統顯示：

```
Current State:
Advisor

Received Event:
VisitAcademicAffairs

Expected:
VisitDepartmentOffice
```

開發項目：

- [x] 顯示完整 Trace
- [x] 顯示目前 State
- [x] 顯示目前 Event
- [x] 顯示下一個合法操作
- [x] 顯示錯誤位置
- [x] 顯示錯誤原因

---

## 16. Automaton Visualization

讓玩家可以直接查看目前任務對應的 Automaton。

例如：

```
(Start)
   │
   ▼
[Advisor]
   │
   ▼
[Department Office]
   │
   ▼
[Academic Affairs]
   │
   ▼
(Complete)
```

開發項目：

- [x] 建立 Automaton Viewer
- [x] 顯示 State
- [x] 顯示 Transition
- [x] Highlight Current State
- [x] Highlight Executed Transition
- [x] 顯示 Accept / Reject

---

## 17. Web 技術

為了讓專題可以輕量開發並方便展示，採用：

```
TypeScript
+
Vite
+
HTML / CSS
+
SVG
+
JSON
```

不使用：Unity、Unreal Engine、3D、Backend、Database、Multiplayer、Login System。

遊戲完成後可以直接透過瀏覽器開啟，方便課堂展示。

---

## 18. 系統架構

```
src/
├── game/
│   ├── player.ts
│   ├── npc.ts
│   ├── map.ts
│   ├── dialogue.ts
│   ├── timeSystem.ts        ← 新增：時間 / 時段管理
│   └── staminaSystem.ts     ← 新增：體力 / 臨時任務管理
│
├── quest/
│   ├── questManager.ts
│   └── questData.json
│
├── automata/
│   ├── DFA.ts
│   ├── NFA.ts
│   ├── transition.ts
│   ├── nfaToDfa.ts
│   ├── pda.ts               ← 規劃中：加退選案例（見第 13A 節）
│   └── minimize.ts          ← 規劃中：任一位老師簽名皆可案例（見第 13B 節）
│
├── verification/
│   ├── verifier.ts
│   ├── trace.ts
│   └── counterexample.ts
│
├── ui/
│   ├── questPanel.ts
│   ├── verificationPanel.ts
│   └── automatonViewer.ts
│
└── main.ts
```

---

## 19. 資料驅動設計

行政流程不直接寫死在遊戲程式中，而是使用 JSON 定義。

例如：

```json
{
  "id": "document-a",
  "name": "文件 A",
  "source": "教務處官網 - 文件A申請說明（查詢日期：2026-XX-XX）",
  "states": ["start", "advisor", "department", "complete"],
  "transitions": [
    ["start", "visit_advisor", "advisor"],
    ["advisor", "visit_department", "department"],
    ["department", "submit_document", "complete"]
  ],
  "npcEvents": {
    "advisor": { "present": "visit_advisor", "absent": "staff_absent" }
  }
}
```

`npcEvents.advisor` 這種 `{ present, absent }` 的寫法對應第 9.3 節的設計：`absent`（`staff_absent`）刻意不出現在 `transitions` 裡，撲空時就會落入「未定義 transition → REJECT」，不需要額外的 Waiting State。這樣可以在不修改 Verification Engine 的情況下增加新的文件流程，也可以直接在資料層加上資料來源註記。

---

## 20. 開發時程（工作項目 Checklist）

### Phase 1：需求與流程分析

- [ ] 確定專題題目
- [ ] 確定遊戲核心玩法
- [ ] 選擇 3～5 個行政文件流程
- [ ] 蒐集官方流程資料，並記錄資料來源與查詢日期
- [ ] 整理每個流程的步驟
- [ ] 找出可能的分支
- [ ] 找出可能的重複流程
- [ ] 定義流程中的 State
- [ ] 定義流程中的 Event
- [ ] 分類每個 NPC 為「固定時段型」或「遊走 / 隨機型」

### Phase 2：Automata

- [x] 建立 DFA 資料結構
- [x] 建立 DFA Simulation
- [x] 建立 NFA 資料結構
- [x] 建立 NFA Simulation
- [x] 實作 NFA → DFA
- [x] 建立行政流程 Automata（含撲空 StaffAbsent → REJECT 的處理，見第 9.3 節）
- [x] 建立合法 Trace 測試
- [x] 建立非法 Trace 測試

### Phase 2A：PDA（加退選案例，規劃中，見第 13A 節）

- [ ] 建立 PDA 資料結構
- [ ] 實作 PDA Simulation
- [ ] 接上 Verification Engine 的 Invalid Transition 判定
- [ ] Automaton Viewer 加上 Stack 顯示
- [ ] 建立合法 / 非法 Trace 測試

### Phase 2B：DFA Minimization（任一位老師簽名皆可案例，規劃中，見第 13B 節）

- [ ] 建立文件 D 的 NFA 資料
- [ ] 執行 NFA → DFA 轉換
- [ ] 實作 Minimization 演算法
- [ ] Automaton Viewer 顯示 Minimize 前後對照
- [ ] 建立 Minimize 前後驗證結果一致的測試

### Phase 3：Verification Engine

- [x] 建立 Event System
- [x] 建立 Trace Recorder
- [x] 建立 Verification Engine
- [x] 實作 Transition Verification
- [x] 實作 ACCEPT
- [x] 實作 REJECT
- [x] 實作 Invalid Transition
- [x] 實作 Counterexample
- [x] 實作「下一個合法操作」提示

### Phase 4：Web RPG

- [x] 建立 Vite 專案
- [x] 建立 TypeScript 專案架構
- [x] 建立校園地圖
- [x] 建立玩家
- [x] 實作 WASD / 方向鍵移動
- [x] 建立 NPC
- [x] 建立 NPC 互動
- [x] 建立對話框
- [x] 建立 Quest System
- [x] 建立任務 UI
- [x] 建立時間系統與跳轉時間功能
- [x] 建立體力系統
- [x] 建立臨時任務（吃飯 / 上課 / 其他）
- [x] 建立遊走 / 隨機型 NPC 的出現邏輯

### Phase 5：遊戲與驗證整合

- [x] 玩家互動產生 Event
- [x] Event 傳入 Verification Engine
- [x] 更新 Automaton State
- [x] 更新 Quest Progress
- [x] 顯示 Trace
- [x] 顯示 ACCEPT / REJECT
- [x] 顯示錯誤原因
- [x] 顯示 Counterexample
- [x] 遊戲內顯示 Automaton
- [x] 確認時間 / 體力 / 臨時任務事件不會誤入 Trace

### Phase 6：視覺化

- [x] 建立 Automaton Viewer
- [x] 顯示 State
- [x] 顯示 Transition
- [x] Highlight Current State
- [x] 顯示玩家 Trace
- [x] 顯示 Verification Result
- [x] 建立 NFA / DFA 顯示模式

### Phase 7：測試

**正常流程**

- [x] 固定順序流程
- [x] 多路徑流程
- [x] 包含重複造訪的流程（合法 Loop）
- [x] 包含 NPC 缺席的流程（撲空 → REJECT）
- [x] 固定時段型 NPC 的時間判定
- [x] 遊走型 NPC 的機率判定
- [x] 體力耗盡觸發臨時任務

**錯誤流程**

- [x] 跳過必要步驟
- [x] 錯誤順序
- [ ] 不合法地點
- [x] 不合法重複操作（非法 Loop → 未定義 transition → REJECT）
- [x] 提前提交文件

**Automata**

- [x] DFA 測試
- [x] NFA 測試
- [x] NFA → DFA 測試
- [x] NFA / DFA 結果一致性測試

### Phase 8：展示與報告

- [ ] 完成最終 Demo 任務
- [ ] 準備合法流程 Demo
- [ ] 準備非法流程 Demo
- [ ] 準備 NFA Demo
- [ ] 準備 NFA → DFA Demo
- [ ] 準備時間系統 Demo（跳轉時間找到固定時段 NPC）
- [ ] 準備體力系統 Demo（觸發臨時任務）
- [ ] 準備 Trace 展示
- [ ] 準備 Counterexample 展示
- [ ] 準備系統架構圖
- [ ] 準備 Automaton 圖
- [ ] 撰寫專題報告
- [ ] 製作簡報

---

## 21. MVP

第一階段不追求完整 RPG，而是先完成可以展示核心概念的版本。

MVP 必須包含

- [ ] 一張簡化校園地圖
- [ ] 一個可控制的玩家
- [ ] 5 個左右 NPC / 地點（至少各 1 個固定時段型與遊走型）
- [ ] 2～3 個行政文件任務
- [ ] 基本時間系統（跳轉時間）
- [ ] 基本體力系統
- [ ] DFA
- [ ] NFA
- [ ] Verification Engine
- [ ] Trace Recorder
- [ ] ACCEPT / REJECT
- [ ] Counterexample
- [x] Automaton Visualization

---

## 22. 最終 Demo

展示時可以按照以下流程：

### Demo 1：接受合法流程

玩家接到：

```
「申請文件 A」
```

接著：

```
承辦老師
 ↓
系辦
 ↓
教務處
```

系統顯示：

```
ACCEPT
```

### Demo 2：故意走錯

玩家：

```
承辦老師
 ↓
教務處
```

系統顯示：

```
REJECT

Invalid Transition

Current State:
Advisor

Received:
VisitAcademicAffairs

Expected:
VisitDepartmentOffice
```

### Demo 3：展示 Automaton

點擊：

```
Show Automaton
```

畫面顯示目前任務的 DFA / NFA。玩家每走一步，Automaton 的 Current State 同步改變。

### Demo 4：展示 NFA → DFA

選擇具有多條合法路徑的文件流程：

```
NFA
 ↓
NFA → DFA
 ↓
Generated DFA
```

展示轉換前後的 State 與 Transition。

### Demo 5：時間與體力系統

玩家在錯誤時段拜訪固定時段型 NPC，得到 `StaffAbsent` 而 REJECT（不影響後續，state 留在原地）；玩家選擇「跳轉時間」到正確時段後再次拜訪，成功推進流程。接著展示體力耗盡觸發臨時任務（吃飯），任務結束後體力恢復、時間也隨之推進。

---

## 23. 預期成果

完成後預計得到一個可以直接在瀏覽器執行的 Web Game：

```
NTUT 校園
    ↓
探索（含時間與體力限制）
    ↓
接取文件任務
    ↓
尋找 NPC / 辦公室（固定時段 or 碰運氣）
    ↓
執行行政流程
    ↓
產生 Execution Trace
    ↓
DFA / NFA Verification
    ↓
ACCEPT / REJECT
```

本專題將「校園行政文件申請」作為實際案例，將其轉換成有限自動機可處理的形式，並透過 Web RPG 讓使用者實際操作流程，再由 Verification Engine 驗證操作是否符合規則。

---

## 24. 專題核心

本專題的核心並不是製作一個大型 RPG，而是：

> 將作者實際申請校內文件時，如同在校園中進行大地遊戲般的經驗，轉換成一個可以由有限自動機描述與驗證的流程。

透過：

```
真實行政流程
      ↓
流程抽象化
      ↓
Regular Language
      ↓
DFA / NFA
      ↓
Web RPG（含時間 / 體力機制強化真實感）
      ↓
Execution Trace
      ↓
Formal Verification
```

將課堂所學的理論與實際軟體系統結合。
