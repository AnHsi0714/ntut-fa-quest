import { GameMap, createGrid, fillRect, setTile } from "./map";
import { TileType } from "./tileTypes";
import type { Direction } from "./pixelSprite";
import type { TimePeriod } from "./timeSystem";
import {
  floorAreaId,
  floorLabel,
  type Area,
  type BuildingAnchors,
  type PlaceLabel,
  type RoomRegion,
  type Warp,
} from "./area";
import {
  buildFloorArea,
  buildingFloors,
  findRoom,
  type BuildingLayout,
  type BuildingSpec,
  type RingFloorPlan,
  type RoomSpec,
  type StripFloorPlan,
} from "./buildingLayout";

export const OUTDOOR_AREA_ID = "campus";
export const MAP_WIDTH = 56;
/** 圍籬內的校園本體高度（不含忠孝東路對面的街廓）。 */
const CAMPUS_HEIGHT = 40;
/** 忠孝東路：CAMPUS_HEIGHT 前兩排，正校門正對著它，過馬路就會走到對面的先鋒大樓。 */
const ZHONGXIAO_ROAD_ROWS: [number, number] = [CAMPUS_HEIGHT - 2, CAMPUS_HEIGHT - 1];
/** 地圖總高度：校園本體 + 忠孝東路對面的街廓（先鋒大樓）。 */
export const MAP_HEIGHT = CAMPUS_HEIGHT + 11;

/** 正門（忠孝東路）進來的第一格：遊戲開始、每天晚上 8:00 閉校後都會回到這裡。 */
export const MAIN_GATE_SPAWN = { areaId: OUTDOOR_AREA_ID, x: 39, y: 36, direction: "up" as Direction };

export interface NpcSpawn {
  id: string;
  name: string;
  /** 對應 NPC_PALETTES 的角色外觀 key，見計畫書第 7 節 NPC 設計。 */
  paletteKey: string;
  /** 對應計畫書 9.1 節：固定時段型 / 遊走型。 */
  kind: "fixed" | "wandering";
  /** kind === "fixed" 時，只有落在這些時段才會出現；不填代表整天都在（例如系辦、教務處）。 */
  availablePeriods?: TimePeriod[];
  /** kind === "wandering" 時，每次時段切換重新擲一次的出現機率（0～1）。 */
  appearChance?: number;
  /**
   * 非任務用途的服務型 NPC，不會送任何事件進 Verification Engine：
   * meal 是餐廳（吃飯補滿體力），print 是影印中心（印申請表）。
   */
  service?: "meal" | "print";
  /** service === "print" 時印出來的東西。 */
  printItem?: "申請單" | "成績單";
  /** 外觀：預設是人，kiosk 是成績單列印機。 */
  appearance?: "kiosk";
  /** 固定辦公室 / 常駐地點的描述，任務面板與對話都用這個字串，不會追蹤 NPC 當下實際走到哪。 */
  locationLabel: string;
  areaId: string;
  x: number;
  y: number;
  direction: Direction;
  greeting: string;
  /** 不屬於任務的閒聊台詞，每次搭話依序講下一句；不填就只講 greeting。 */
  lines?: string[];
  /**
   * 會在地圖上走動的 NPC 輪流前往的目的地（同一個區域裡的格子座標），不填代表站著不動。
   * NPC 會自己找路走過去，所以目的地之間不需要直線相連。
   */
  destinations?: Array<{ x: number; y: number }>;
}

type WallMaterial =
  | TileType.WallRedBrick
  | TileType.WallYellowTile
  | TileType.WallTanMosaic
  | TileType.WallWashedStone
  | TileType.WallGlass
  | TileType.WallConcrete;

/**
 * 戶外地圖上的建築物外觀。有 interior 的建築物才能從門口走進去，其餘只是地標。
 * 建築物名稱與相對位置參考北科大官網「校園地圖」：正門在忠孝東路，側門在新生南路與建國南路；
 * 正門左側是行政大樓、圖書館、教學大樓、紅樓等，右側是綜合科館與學生活動中心；
 * 新生南路側門往北是光華館、第六教學大樓與宏裕科技研究大樓（科研大樓），往南是土木館、材資館、設計館。
 * 位置只求大致方位正確，並非等比例重現。
 */
interface OutdoorBuilding {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 外牆材質，見 tileTypes.ts 的說明。 */
  material: WallMaterial;
  /** 大門位置，走上去就會進到 1F；預設在建築物最下面一排，見 entranceSide。 */
  door?: { x: number; y: number };
  /**
   * 大門面向哪一側，決定走出大門後玩家出現的位置與面向。預設 "south"（大門在建築物最下面一排，
   * 出來後站在門口正下方、面向下）；先鋒大樓的門在北側（面向忠孝東路對面的正校門），
   * 出來後要站在門口正上方、面向上，才不會一出來就對著自己剛走出來的牆。
   */
  entranceSide?: "south" | "north";
  interior?: { topFloor: number; basementCount?: number; layout: BuildingLayout };
}

/** 房號開頭的數字（例如「331 資工系辦」→ 331、「110_1」→ 110），用來避免補房號時撞號。 */
function roomNumberOf(spec: RoomSpec): number | undefined {
  const name = typeof spec === "string" ? spec : spec.name;
  const match = name?.match(/^(\d+)/);
  return match ? Number(match[1]) : undefined;
}

/** 依樓層產生還沒用過的房號：3F → 301、302……；12F → 1201、1202……。 */
function roomNumberGenerator(floor: number, known: RoomSpec[]): () => string {
  const used = new Set(known.map(roomNumberOf).filter((n): n is number => n !== undefined));
  let next = 1;
  return () => {
    while (used.has(Number(`${floor}${String(next).padStart(2, "0")}`))) next++;
    const name = `${floor}${String(next).padStart(2, "0")}`;
    next++;
    return name;
  };
}

/**
 * 長條型的一層：先依序放查得到的房間（北側由西到東，放滿再換南側），
 * 剩下的格子依樓層補上還沒用過的房號。跨格的大房間不能跨過電梯 / 大廳。
 */
function stripFloor(
  floor: number,
  slotsWest: number,
  slotsEast: number,
  known: RoomSpec[]
): StripFloorPlan {
  const perSide = slotsWest + slotsEast;
  const nextNumber = roomNumberGenerator(floor, known);
  const queue = [...known];
  const sides: Array<Array<RoomSpec | null>> = [[], []];
  for (const row of sides) {
    while (row.length < perSide) {
      const next = queue[0];
      const span = next && typeof next !== "string" ? next.span ?? 1 : 1;
      const pos = row.length;
      const fits = pos + span <= perSide && !(pos < slotsWest && pos + span > slotsWest);
      if (next && fits) {
        row.push(next);
        for (let k = 1; k < span; k++) row.push(null);
        queue.shift();
      } else {
        row.push(nextNumber());
      }
    }
  }
  if (queue.length > 0) throw new Error(`${floor} 樓的房間放不下：${queue.length} 間`);
  return { north: sides[0], south: sides[1] };
}

/** 環形的一層：先放查得到的房間，剩下的依樓層補上房號。 */
function ringFloor(floor: number, slots: number, known: RoomSpec[]): RingFloorPlan {
  const nextNumber = roomNumberGenerator(floor, known);
  const rooms: RoomSpec[] = [...known];
  while (rooms.length < slots) rooms.push(nextNumber());
  return { rooms };
}

/** 長條型建築：每一層都照 stripFloor 補滿；basements 是地下室的明確配置（不補教室）。 */
function stripBuilding(
  slotsWest: number,
  slotsEast: number,
  topFloor: number,
  known: Record<number, RoomSpec[]>,
  basements: Record<number, StripFloorPlan> = {}
): BuildingLayout {
  const floors: Record<number, StripFloorPlan> = { ...basements };
  for (let floor = 1; floor <= topFloor; floor++) {
    floors[floor] = stripFloor(floor, slotsWest, slotsEast, known[floor] ?? []);
  }
  return { type: "strip", slotsWest, slotsEast, floors };
}

/**
 * 建築物位置依北科大校園平面圖（北邊八德路、西邊新生南路、南邊忠孝東路、東邊建國南路）換算成格子，
 * 只求相對位置正確，並非等比例重現。東校區（宿舍、運動場、億光大樓）不在這張地圖上。
 *
 * 房號來源：課務系統「114 學年度第 2 學期教室使用表」（排課用的教室），再加上教務處「E化教室一覽表」。
 * 表上沒有的房間（辦公室、研究室等）依樓層補上房號，所以補出來的號碼不一定是實際房號。
 * 單位位置來源見各棟的註解；標「遊戲設定」的是查不到、為了任務而安排的位置。
 */
const BUILDINGS: OutdoorBuilding[] = [
  {
    id: "research",
    // 宏裕科技研究大樓，學生通稱「科研大樓」，長條型。地上 16 層，B3 是影印中心（B1、B2 查不到用途，不放房間）。
    // 資工系辦在 3F 331 室（資工系網站「聯絡方式」）；系主任室、12F 教師研究室與實驗室，
    // 以及文件 D 的 5F 指導老師研究室、9F 導師研究室、13F 教師研究室都是遊戲設定。
    name: "科研大樓",
    material: TileType.WallGlass,
    x: 14,
    y: 2,
    w: 6,
    h: 7,
    door: { x: 16, y: 8 },
    interior: {
      topFloor: 16,
      basementCount: 3,
      layout: stripBuilding(
        3,
        3,
        16,
        {
          2: ["231", "232", "234", "235", "240", "243"],
          3: ["331 資工系辦", "系主任室", "332", "334"],
          4: ["427", "430", "440", "442"],
          5: ["指導老師研究室"],
          6: ["640"],
          7: ["727", "732", "734", "735"],
          8: ["823", "825"],
          9: ["導師研究室"],
          12: ["教師研究室", "實驗室", "1222", "1223"],
          13: ["教師研究室", "1322"],
        },
        { [-3]: { north: ["影印中心"] } }
      ),
    },
  },
  {
    id: "sixth",
    // 第六教學大樓：地上 7 層，長條型。B1 是國際會議廳（校園平面圖）；B2～B4 查不到用途，不放房間。
    name: "第六教學大樓",
    material: TileType.WallConcrete,
    x: 14,
    y: 10,
    w: 6,
    h: 2,
    door: { x: 16, y: 11 },
    interior: {
      topFloor: 7,
      basementCount: 4,
      layout: stripBuilding(
        2,
        2,
        7,
        {
          2: ["224", "226", "227"],
          3: ["325", "326", "327"],
          4: ["426", "427"],
          5: ["525", "526", "527"],
          6: ["625", "626", "627"],
          7: ["725", "726", "727"],
        },
        { [-1]: { south: [{ name: "國際會議廳", span: 2 }] } }
      ),
    },
  },
  {
    id: "guanghua",
    // 光華館：1、2 樓是「綠光庭園」餐廳區，裡面有路易莎等店家（Dcard「北科學餐 綠光庭園」）；
    // 4F 有 400～410 教室（教室使用表），所以至少 4 層。
    name: "光華館",
    material: TileType.WallConcrete,
    x: 4,
    y: 2,
    w: 9,
    h: 7,
    door: { x: 8, y: 8 },
    interior: {
      topFloor: 4,
      layout: stripBuilding(2, 2, 4, {
        1: [{ name: "綠光庭園", span: 2 }],
        2: [{ name: "綠光庭園", span: 2 }],
        4: ["400", "403", "404", "405", "406", "410"],
      }),
    },
  },
  {
    id: "admin",
    // 各處室樓層依北科大官網「行政單位」頁面：1F 學務處、軍訓室，2F 教務處，3F 人事室，
    // 4F 環安中心、校務研究與永續發展中心，5F 產學合作處、進修部，6F 研發處、主計室，
    // 7F 總務處，8F 校長室、秘書室。其他房間的房號是補上的。
    name: "行政大樓",
    material: TileType.WallTanMosaic,
    x: 32,
    y: 26,
    w: 6,
    h: 5,
    door: { x: 34, y: 30 },
    interior: {
      topFloor: 8,
      layout: stripBuilding(2, 2, 8, {
        1: ["學務處", "軍訓室"],
        2: ["教務處"],
        3: ["人事室"],
        4: ["環安中心", "校務研究中心"],
        5: ["產學合作處", "進修部"],
        6: ["研發處", "主計室"],
        7: ["總務處"],
        8: ["校長室", "秘書室"],
      }),
    },
  },
  {
    id: "teaching3",
    // 第三教學大樓：環形，房間繞一圈、中間鏤空（1F 是可以走的中庭）。1F 聯合服務中心（聯合服務中心網站）。
    // 1F 南側正中間是大廳，所以 1F 有 12 間、2F 以上 13 間房。
    name: "第三教學大樓",
    material: TileType.WallYellowTile,
    x: 21,
    y: 23,
    w: 10,
    h: 6,
    door: { x: 25, y: 28 },
    interior: {
      topFloor: 5,
      layout: {
        type: "ring",
        across: 5,
        side: 2,
        floors: {
          1: ringFloor(1, 12, ["聯合服務中心", "109"]),
          2: ringFloor(2, 13, ["201", "202", "206", "207", "208", "209", "210"]),
          3: ringFloor(3, 13, ["301", "302", "303", "306", "307", "308", "309", "310"]),
          4: ringFloor(4, 13, ["401", "402", "403", "406", "407", "408", "409", "410"]),
          5: ringFloor(5, 13, ["501", "502", "503", "504", "505", "506", "507", "508", "509", "510"]),
        },
      },
    },
  },
  {
    id: "teaching1",
    // 第一教學大樓：1F 多功能教室、3F 301～303（教室使用表）。
    name: "第一教學大樓",
    material: TileType.WallWashedStone,
    x: 14,
    y: 16,
    w: 6,
    h: 2,
    door: { x: 16, y: 17 },
    interior: {
      topFloor: 3,
      layout: stripBuilding(1, 1, 3, { 1: ["多功能教室"], 3: ["301", "302", "303"] }),
    },
  },
  {
    id: "teaching2",
    // 第二教學大樓：1F 國際處（官網「行政單位」）與 103；2F 201～207；3F 301～307（教室使用表）。
    name: "第二教學大樓",
    material: TileType.WallWashedStone,
    x: 21,
    y: 16,
    w: 10,
    h: 2,
    door: { x: 24, y: 17 },
    interior: {
      topFloor: 3,
      layout: stripBuilding(2, 2, 3, {
        1: ["國際處", "103"],
        2: ["201", "202", "203", "204", "205", "206", "207"],
        3: ["301", "302", "303", "304", "305", "306", "307"],
      }),
    },
  },
  {
    id: "teaching4",
    // 第四教學大樓：1F 校友聯絡中心（官網「行政單位」）與 102、103；2F 203、204；3F 302～304（教室使用表）。
    name: "第四教學大樓",
    material: TileType.WallWashedStone,
    x: 14,
    y: 21,
    w: 2,
    h: 7,
    door: { x: 14, y: 27 },
    interior: {
      topFloor: 3,
      layout: stripBuilding(2, 2, 3, {
        1: ["校友聯絡中心", "102", "103"],
        2: ["203", "204"],
        3: ["302", "303", "304"],
      }),
    },
  },
  {
    id: "general",
    // 共同科館：1F 計網中心（官網「行政單位」）、B1 演講廳（校園平面圖）；教室到 7F（教室使用表）。
    name: "共同科館",
    material: TileType.WallConcrete,
    x: 21,
    y: 30,
    w: 10,
    h: 6,
    door: { x: 25, y: 35 },
    interior: {
      topFloor: 7,
      basementCount: 1,
      layout: stripBuilding(
        3,
        3,
        7,
        {
          1: ["計網中心", "103A"],
          3: ["301_1", "302", "303A", "312", "313"],
          4: ["401", "403", "411", "412", "413"],
          6: ["606", "614", "615", "616"],
          7: ["714", "715", "716"],
        },
        { [-1]: { south: [{ name: "演講廳", span: 3 }] } }
      ),
    },
  },
  {
    id: "complex",
    // 綜合科館：教室、實驗室到 8F，B1 有 B02（教室使用表）。
    name: "綜合科館",
    material: TileType.WallTanMosaic,
    x: 42,
    y: 21,
    w: 10,
    h: 15,
    door: { x: 46, y: 35 },
    interior: {
      topFloor: 8,
      basementCount: 1,
      layout: stripBuilding(
        3,
        3,
        8,
        {
          1: ["104", "110_1", "110_2", "115"],
          2: ["216", "219"],
          3: ["305", "306", "318", "322", "327", "328", "328_1"],
          4: ["414", "417", "421", "422", "428"],
          5: ["501", "502", "511", "513", "514"],
          6: ["610"],
          8: ["802"],
        },
        { [-1]: { north: ["B02"] } }
      ),
    },
  },
  {
    id: "design",
    // 設計館：教室到 7F，B1 有 B01（教室使用表）。
    name: "設計館",
    material: TileType.WallWashedStone,
    x: 5,
    y: 29,
    w: 12,
    h: 5,
    door: { x: 10, y: 33 },
    interior: {
      topFloor: 7,
      basementCount: 1,
      layout: stripBuilding(
        3,
        3,
        7,
        {
          1: ["106"],
          2: ["205", "207", "251", "252"],
          3: ["301", "306", "354"],
          4: ["401", "403", "407", "409", "452", "453"],
          5: ["501", "503", "507", "509"],
          6: ["603"],
          7: ["701", "703", "753"],
        },
        { [-1]: { north: ["B01"] } }
      ),
    },
  },
  { id: "memorial", name: "國父百年紀念館", material: TileType.WallWashedStone, x: 4, y: 10, w: 9, h: 2 },
  { id: "alumni", name: "校友會館", material: TileType.WallConcrete, x: 21, y: 2, w: 7, h: 5 },
  { id: "chemEng", name: "化學工程館", material: TileType.WallConcrete, x: 21, y: 8, w: 8, h: 3 },
  { id: "molecular", name: "分子科學工程館", material: TileType.WallConcrete, x: 30, y: 8, w: 8, h: 3 },
  { id: "activity", name: "學生活動中心", material: TileType.WallConcrete, x: 42, y: 10, w: 10, h: 6 },
  { id: "civil", name: "土木館", material: TileType.WallWashedStone, x: 4, y: 17, w: 8, h: 3 },
  { id: "materials", name: "材資館", material: TileType.WallWashedStone, x: 4, y: 22, w: 8, h: 3 },
  { id: "chemistry", name: "化學館", material: TileType.WallWashedStone, x: 32, y: 16, w: 5, h: 4 },
  { id: "redHouse", name: "紅樓", material: TileType.WallRedBrick, x: 26, y: 19, w: 4, h: 2 },
  { id: "history", name: "校史館", material: TileType.WallWashedStone, x: 17, y: 21, w: 3, h: 7 },
  {
    id: "library",
    // 圖書館：官網「樓層配置」頁面列出各樓層服務分區。
    name: "圖書館",
    material: TileType.WallTanMosaic,
    x: 32,
    y: 21,
    w: 6,
    h: 4,
    door: { x: 34, y: 24 },
    interior: {
      topFloor: 3,
      basementCount: 1,
      layout: stripBuilding(
        1,
        1,
        3,
        {
          1: ["資料檢索區", "老蕭書房", "多媒體學習中心", "流通服務檯"],
          2: ["西文書區", "期刊資料區", "自學中心", "漫畫區"],
          3: ["參考書區", "論文區", "中文書區", "期刊合訂本區"],
        },
        { [-1]: { north: ["視聽室", "自習室"] } }
      ),
    },
  },
  { id: "artCenter", name: "藝文中心", material: TileType.WallConcrete, x: 32, y: 32, w: 5, h: 1 },
  {
    id: "pioneer",
    // 先鋒國際研發大樓：官網「本校導覽」提到位在正門對面（忠孝東路），需要過馬路才能到；
    // 2022 年啟用。課務系統教室使用表查得到 2F、4F、5F、6F、14F 的房號，其餘樓層補上房號。
    name: "先鋒大樓",
    material: TileType.WallGlass,
    x: 36,
    y: 42,
    w: 8,
    h: 6,
    door: { x: 39, y: 42 },
    // 大門面向忠孝東路（北側），跟其他建築物的大門方向相反。
    entranceSide: "north",
    interior: {
      topFloor: 14,
      layout: stripBuilding(3, 3, 14, {
        2: ["201", "202", "203"],
        4: ["401", "402", "403", "404"],
        5: ["501", "502", "503", "504"],
        6: ["601", "602"],
        14: [{ name: "1402 問題導向學習教室" }],
      }),
    },
  },
];

function buildOutdoorArea(
  buildings: OutdoorBuilding[],
  entranceOf: (buildingId: string) => BuildingAnchors["entranceArrival"]
): Area {
  const grid = createGrid(MAP_WIDTH, MAP_HEIGHT, TileType.Grass);

  // 校外馬路：西邊新生南路、東邊建國南路（貫穿整張地圖，包含忠孝東路對面的街廓）、南邊忠孝東路
  fillRect(grid, 0, 0, 2, MAP_HEIGHT, TileType.Road);
  fillRect(grid, MAP_WIDTH - 2, 0, 2, MAP_HEIGHT, TileType.Road);
  fillRect(grid, 0, ZHONGXIAO_ROAD_ROWS[0], MAP_WIDTH, 2, TileType.Road);

  // 校園圍籬（樹林），只圍住校園本體；忠孝東路對面的街廓（先鋒大樓）另外圍一圈
  fillRect(grid, 2, 0, MAP_WIDTH - 4, 1, TileType.Border);
  fillRect(grid, 2, 0, 1, ZHONGXIAO_ROAD_ROWS[0], TileType.Border);
  fillRect(grid, MAP_WIDTH - 3, 0, 1, ZHONGXIAO_ROAD_ROWS[0], TileType.Border);
  fillRect(grid, 2, ZHONGXIAO_ROAD_ROWS[0] - 1, MAP_WIDTH - 4, 1, TileType.Border);

  // 校門：正校門（忠孝東路）、新生校門、新生側門（新生南路）、建國側門（建國南路）。
  // 道路都是 4 格寬，玩家跟走動的學生可以錯身而過。
  fillRect(grid, 38, ZHONGXIAO_ROAD_ROWS[0] - 1, 4, 1, TileType.Gate);
  fillRect(grid, 2, 12, 1, 4, TileType.Gate);
  fillRect(grid, 2, 25, 1, 4, TileType.Gate);
  fillRect(grid, MAP_WIDTH - 3, 17, 1, 4, TileType.Gate);

  // 道路
  fillRect(grid, 38, 12, 4, CAMPUS_HEIGHT - 15, TileType.Path); // 正校門往北的主幹道
  fillRect(grid, 3, 12, 35, 4, TileType.Path); // 新生校門進來、橫貫校園北側的道路
  fillRect(grid, 42, 17, MAP_WIDTH - 45, 4, TileType.Path); // 建國側門進來的道路
  fillRect(grid, 3, 25, 10, 4, TileType.Path); // 新生側門進來的道路

  // 正校門內、行政大樓前的廣場
  fillRect(grid, 31, 33, 8, 4, TileType.Plaza);

  // 忠孝東路對面的街廓（先鋒大樓）：人行穿越道 + 圍住這一塊的樹林
  fillRect(grid, 38, ZHONGXIAO_ROAD_ROWS[0], 4, 2, TileType.Crosswalk);
  fillRect(grid, 2, ZHONGXIAO_ROAD_ROWS[1] + 1, 1, MAP_HEIGHT - ZHONGXIAO_ROAD_ROWS[1] - 2, TileType.Border);
  fillRect(
    grid,
    MAP_WIDTH - 3,
    ZHONGXIAO_ROAD_ROWS[1] + 1,
    1,
    MAP_HEIGHT - ZHONGXIAO_ROAD_ROWS[1] - 2,
    TileType.Border
  );
  fillRect(grid, 2, MAP_HEIGHT - 1, MAP_WIDTH - 4, 1, TileType.Border);

  const warps: Warp[] = [];
  const labels: PlaceLabel[] = [
    // 正門標籤放在校門外的忠孝東路上，不要蓋住站在門內的警衛
    { text: "正校門（忠孝東路）", x: 39.5, y: ZHONGXIAO_ROAD_ROWS[1] },
    { text: "新生校門", x: 3.5, y: 12 },
    { text: "新生側門", x: 3.5, y: 25 },
    { text: "建國側門", x: MAP_WIDTH - 5, y: 17 },
  ];

  for (const building of buildings) {
    fillRect(grid, building.x, building.y, building.w, building.h, building.material);
    // 名稱放在建築物正中央（標籤底邊貼在這個 y 的上緣，所以往下多推半格）
    labels.push({
      text: building.name,
      x: building.x + (building.w - 1) / 2,
      y: building.y + building.h / 2 + 0.5,
    });

    if (building.door && building.interior) {
      setTile(grid, building.door.x, building.door.y, TileType.Door);
      const entrance = entranceOf(building.id);
      warps.push({
        x: building.door.x,
        y: building.door.y,
        toAreaId: floorAreaId(building.id, 1),
        toX: entrance.x,
        toY: entrance.y,
        direction: entrance.direction,
      });
    }
  }

  return {
    id: OUTDOOR_AREA_ID,
    name: "校園",
    map: new GameMap(MAP_WIDTH, MAP_HEIGHT, grid),
    warps,
    labels,
    rooms: [],
  };
}

function toBuildingSpec(building: OutdoorBuilding): BuildingSpec | undefined {
  if (!building.door || !building.interior) return undefined;
  const north = building.entranceSide === "north";
  return {
    ...building.interior,
    id: building.id,
    name: building.name,
    outdoorExit: {
      areaId: OUTDOOR_AREA_ID,
      x: building.door.x,
      y: building.door.y + (north ? -1 : 1),
      direction: north ? "up" : "down",
    },
  };
}

/** 任務相關單位的辦公室位置：NPC 設定、警衛與服務台的指路台詞、任務面板都共用這份，避免寫法不一致。 */
const OFFICES = {
  advisor: "科研大樓 12F 教師研究室",
  department: "科研大樓 3F 331 資工系辦",
  departmentHead: "科研大樓 3F 系主任室",
  academicAffairs: "行政大樓 2F 教務處",
} as const;

/** NPC 擺放位置用的查詢工具：依建築物、樓層、房間名稱找到實際座標。 */
class WorldLookup {
  constructor(private readonly areas: Map<string, Area>) {}

  area(buildingId: string, floor: number): Area {
    const area = this.areas.get(floorAreaId(buildingId, floor));
    if (!area) throw new Error(`找不到 ${buildingId} ${floorLabel(floor)}`);
    return area;
  }

  room(buildingId: string, floor: number, name: string): RoomRegion {
    return findRoom(this.area(buildingId, floor), name);
  }

  /** 站在房間裡的固定位置（從門口往內走兩步就能面對）；offset 可以再往旁邊挪。 */
  inRoom(
    buildingId: string,
    floor: number,
    name: string,
    offset?: { dx: number; dy: number; direction: Direction }
  ) {
    const { npcSpot } = this.room(buildingId, floor, name);
    return {
      areaId: floorAreaId(buildingId, floor),
      x: npcSpot.x + (offset?.dx ?? 0),
      y: npcSpot.y + (offset?.dy ?? 0),
      direction: offset?.direction ?? npcSpot.direction,
    };
  }
}

function declareQuestNpcs(w: WorldLookup): NpcSpawn[] {
  return [
    {
      id: "advisor",
      name: "承辦老師",
      paletteKey: "advisor",
      kind: "fixed",
      // 老師只有下午在研究室，早上／中午／晚上去都會撲空（計畫書 9.3 / 9.4 節示範案例）。
      availablePeriods: ["afternoon"],
      locationLabel: OFFICES.advisor,
      ...w.inRoom("research", 12, "教師研究室"),
      greeting: "你好，我是承辦老師。行政文件申請都要先經過我這邊簽核。",
    },
    {
      id: "academicAffairs",
      name: "教務處人員",
      paletteKey: "academicAffairs",
      kind: "fixed",
      locationLabel: OFFICES.academicAffairs,
      ...w.inRoom("admin", 2, "教務處"),
      greeting: "歡迎來到教務處，大部分文件申請流程都會在這裡送出、完成。",
    },
    {
      id: "department",
      name: "系辦人員",
      paletteKey: "department",
      kind: "fixed",
      locationLabel: OFFICES.department,
      ...w.inRoom("research", 3, "331 資工系辦"),
      greeting: "系辦已經收件，請依你目前申請的文件確認接下來還要去哪裡。",
    },
    {
      id: "departmentHead",
      name: "系主任",
      paletteKey: "departmentHead",
      kind: "wandering",
      // 系主任開會、跑班機率頗高，每次時段切換有 50% 機率在辦公室（計畫書 9.1 節遊走型範例）。
      appearChance: 0.5,
      locationLabel: OFFICES.departmentHead,
      ...w.inRoom("research", 3, "系主任室"),
      greeting: "我是系主任，有些文件需要我這邊簽核，跟系辦的先後順序都可以。",
    },
  ];
}

/** 文件 D 可以簽名的三位老師（計畫書 13B 節），任一位簽名都可以。位置與在場時段是遊戲設定。 */
function declareDocumentDTeachers(w: WorldLookup): NpcSpawn[] {
  return [
    {
      id: "homeroomTeacher",
      name: "導師",
      paletteKey: "homeroom",
      kind: "fixed",
      availablePeriods: ["morning", "afternoon"],
      locationLabel: "科研大樓 9F 導師研究室",
      ...w.inRoom("research", 9, "導師研究室"),
      greeting: "我是你的導師，申請單拿來我幫你簽。",
    },
    {
      id: "clubAdvisor",
      name: "系學會指導老師",
      paletteKey: "clubAdvisor",
      kind: "fixed",
      availablePeriods: ["afternoon", "evening"],
      locationLabel: "科研大樓 5F 指導老師研究室",
      ...w.inRoom("research", 5, "指導老師研究室"),
      greeting: "系學會的事找我就對了，這張我可以簽。",
    },
    {
      id: "departmentTeacher",
      name: "系上老師",
      paletteKey: "teacher",
      kind: "wandering",
      appearChance: 0.5,
      locationLabel: "科研大樓 13F 教師研究室",
      ...w.inRoom("research", 13, "教師研究室"),
      greeting: "系上任何一位老師簽都可以，我幫你簽吧。",
    },
  ];
}

function declareServiceNpcs(w: WorldLookup): NpcSpawn[] {
  return [
    {
      id: "cafeteria",
      name: "餐廳老闆",
      paletteKey: "cafeteria",
      kind: "fixed",
      service: "meal",
      locationLabel: "光華館 1F 綠光庭園",
      ...w.inRoom("guanghua", 1, "綠光庭園"),
      greeting: "歡迎光臨！吃飽才有力氣跑行政流程。",
    },
    {
      id: "cafeteria2F",
      name: "餐廳店員",
      paletteKey: "cafeteria",
      kind: "fixed",
      service: "meal",
      locationLabel: "光華館 2F 綠光庭園",
      ...w.inRoom("guanghua", 2, "綠光庭園"),
      greeting: "二樓也有位子，慢慢吃。",
    },
    {
      id: "printShop",
      name: "影印店老闆",
      paletteKey: "printShop",
      kind: "fixed",
      service: "print",
      locationLabel: "科研大樓 B3 影印中心",
      ...w.inRoom("research", -3, "影印中心"),
      greeting: "影印中心，要印什麼？",
      printItem: "申請單",
    },
    // 成績單只能用列印機印：行政大樓 2F 教務處、5F 進修部，以及三教 1F 聯合服務中心（遊戲設定）。
    {
      id: "transcriptKioskAcademic",
      name: "成績單列印機",
      paletteKey: "kiosk",
      appearance: "kiosk",
      kind: "fixed",
      service: "print",
      printItem: "成績單",
      locationLabel: "行政大樓 2F 教務處",
      ...w.inRoom("admin", 2, "教務處", { dx: 2, dy: -1, direction: "down" }),
      greeting: "成績單列印機。",
    },
    {
      id: "transcriptKioskContinuing",
      name: "成績單列印機",
      paletteKey: "kiosk",
      appearance: "kiosk",
      kind: "fixed",
      service: "print",
      printItem: "成績單",
      locationLabel: "行政大樓 5F 進修部",
      ...w.inRoom("admin", 5, "進修部"),
      greeting: "成績單列印機。",
    },
    {
      id: "transcriptKioskService",
      name: "成績單列印機",
      paletteKey: "kiosk",
      appearance: "kiosk",
      kind: "fixed",
      service: "print",
      printItem: "成績單",
      locationLabel: "第三教學大樓 1F 聯合服務中心",
      ...w.inRoom("teaching3", 1, "聯合服務中心"),
      greeting: "成績單列印機。",
    },
  ];
}

/** 輔助 NPC（計畫書第 7 節）：只提供辦公室位置與流程提示，不會送任何事件進 Verification Engine。 */
function declareHelperNpcs(w: WorldLookup): NpcSpawn[] {
  const research3F = w.area("research", 3);
  const deptOffice = w.room("research", 3, "331 資工系辦");
  const headOffice = w.room("research", 3, "系主任室");
  const lab = w.room("research", 12, "實驗室");

  return [
    // 警衛只在正校門與新生校門，站在校門最旁邊那一格，不擋住進出的路。
    {
      id: "guard",
      name: "正門警衛",
      paletteKey: "guard",
      kind: "fixed",
      locationLabel: "正校門",
      areaId: OUTDOOR_AREA_ID,
      x: 41,
      y: ZHONGXIAO_ROAD_ROWS[0] - 1,
      direction: "up",
      greeting: "我是正門警衛。",
      lines: [
        "我是正門警衛。校園晚上 8 點關門，時間到了我會請你離開，隔天早上 8 點再來。",
        `要找辦公室的話：承辦老師在${OFFICES.advisor}；系辦是${OFFICES.department}，系主任室就在隔壁；教務處在行政大樓 2F。`,
        "科研大樓：沿主幹道往北走到底，再沿新生校門那條路往西就到了。行政大樓：正校門進來左手邊，廣場後面。",
        "肚子餓的話，光華館 1、2F 的綠光庭園有得吃，吃飽體力就回來了。各棟 1F 大廳也有休息區可以坐一下。",
        "要印申請單的話，科研大樓 B3 有影印中心；成績單要到行政大樓 2F、5F 或三教 1F 的列印機印。",
        "正校門正對面過個馬路就是先鋒大樓，走人行穿越道過去比較安全。",
      ],
    },
    {
      id: "xinshengGuard",
      name: "新生校門警衛",
      paletteKey: "guard",
      kind: "fixed",
      locationLabel: "新生校門",
      areaId: OUTDOOR_AREA_ID,
      x: 2,
      y: 15,
      direction: "right",
      greeting: "這裡是新生校門。",
      lines: [
        "這裡是新生校門。往北是光華館（綠光庭園）、科研大樓跟六教，往東沿著這條路一直走就會接到正校門的主幹道。",
        "科研大樓 B3 有影印中心，印申請單就去那邊。",
        "晚上 8 點全校關門，關門後會請大家從正校門離開。",
      ],
    },
    {
      id: "senior",
      name: "資工系學長",
      paletteKey: "senior",
      kind: "fixed",
      locationLabel: "科研大樓 3F 走廊",
      areaId: research3F.id,
      x: 6,
      y: 8,
      direction: "down",
      greeting: "學弟妹也來跑流程啊？",
      lines: [
        "承辦老師通常只有下午（13:00～17:00）會在研究室，早上去大概會撲空。",
        "系主任常常要開會，每個時段在不在都不一定，撲空了就晚點再來看看。",
        "文件 B 要系辦跟系主任都處理過才能送教務處，這兩個誰先誰後都可以。",
        "老師研究室在 12 樓，用爬的超累，搭電梯雖然要等一下，體力省很多。",
      ],
      // 在走廊上來回：樓梯口附近、系辦門口、系主任室門口、走廊東側
      destinations: [
        { x: 5, y: 8 },
        { x: deptOffice.doorX + 1, y: 7 },
        { x: headOffice.doorX, y: 8 },
        { x: research3F.map.width - 4, y: 8 },
      ],
    },
    {
      id: "ta",
      name: "系辦助教",
      paletteKey: "ta",
      kind: "fixed",
      locationLabel: OFFICES.department,
      // 站在系辦裡、系辦人員的右後方
      ...w.inRoom("research", 3, "331 資工系辦", { dx: 2, dy: -1, direction: "left" }),
      greeting: "我是系辦助教。",
      lines: [
        "我是系辦助教。要印申請表的話，這棟 B3 就有影印中心。",
        "文件 A 要先給承辦老師簽，再拿來系辦，最後送教務處，順序不能換。",
        "系主任常常要開會，我也不知道他現在在不在，你直接去隔壁看看吧。",
      ],
    },
    {
      id: "gradStudentA",
      name: "研究生",
      paletteKey: "gradA",
      kind: "fixed",
      locationLabel: "科研大樓 12F 實驗室",
      ...w.inRoom("research", 12, "實驗室"),
      greeting: "在趕實驗中……",
      lines: [
        "老師通常下午才會進研究室，早上都在家寫計畫。",
        "要找老師簽名的話，下午一點以後再來比較保險。",
      ],
      // 在實驗室裡走來走去看儀器，不會走出房間（NPC 不走門口）
      destinations: [
        { x: lab.npcSpot.x, y: lab.npcSpot.y },
        { x: lab.x1, y: lab.y0 },
        { x: lab.x1, y: lab.y1 - 1 },
        { x: lab.x0, y: lab.y1 },
      ],
    },
    {
      id: "gradStudentB",
      name: "研究生",
      paletteKey: "gradB",
      kind: "fixed",
      locationLabel: "科研大樓 12F 實驗室",
      areaId: floorAreaId("research", 12),
      x: lab.x0,
      y: lab.y0,
      direction: "right",
      greeting: "論文好難寫。",
      lines: ["論文好難寫。", "隔壁就是老師的研究室，門關著的話要走進去才知道老師在不在。"],
    },
    {
      id: "studentPlaza",
      name: "路過的學生",
      paletteKey: "studentA",
      kind: "fixed",
      locationLabel: "正門廣場",
      areaId: OUTDOOR_AREA_ID,
      x: 35,
      y: 34,
      direction: "down",
      greeting: "嗨！",
      lines: [
        "正門在忠孝東路上，新生南路跟建國南路那邊各有一個側門。",
        "紅樓是創校時期留下來的建築，已經被臺北市政府列為古蹟。",
        "行政大樓 2 樓是教務處，校長室在 8 樓。",
      ],
      // 正校門廣場、行政大樓門口、三教門口、紅樓前之間走來走去
      destinations: [
        { x: 35, y: 34 },
        { x: 34, y: 31 },
        { x: 25, y: 29 },
        { x: 28, y: 21 },
        { x: 37, y: 36 },
      ],
    },
    {
      id: "studentCentral",
      name: "趕課的學生",
      paletteKey: "studentB",
      kind: "fixed",
      locationLabel: "校園中央道路",
      areaId: OUTDOOR_AREA_ID,
      x: 10,
      y: 14,
      direction: "right",
      greeting: "我要遲到了！",
      lines: [
        "學務處跟軍訓室都在行政大樓 1 樓。",
        "國際處在第二教學大樓 1 樓，計網中心在共同科館 1 樓，聯合服務中心在三教 1 樓。",
        "我要遲到了，先走囉！",
      ],
      // 在光華館、科研大樓、六教、一教、二教門口與北側道路之間趕場
      destinations: [
        { x: 8, y: 9 },
        { x: 17, y: 9 },
        { x: 16, y: 12 },
        { x: 16, y: 18 },
        { x: 24, y: 18 },
        { x: 34, y: 14 },
      ],
    },
    {
      id: "studentEast",
      name: "社團的學生",
      paletteKey: "studentC",
      kind: "fixed",
      locationLabel: "建國側門道路",
      areaId: OUTDOOR_AREA_ID,
      x: 45,
      y: 19,
      direction: "left",
      greeting: "社團博覽會快到了！",
      lines: [
        "學生活動中心在建國南路側門附近，社團活動大多在那邊。",
        "光華館一、二樓是綠光庭園，有路易莎可以喝咖啡。",
      ],
      // 學生活動中心、建國側門道路、綜合科館門口、主幹道
      destinations: [
        { x: 45, y: 19 },
        { x: 46, y: 17 },
        { x: 51, y: 19 },
        { x: 46, y: 36 },
        { x: 41, y: 25 },
      ],
    },
  ];
}

/** 每棟可進入建築物 1F 的服務台：告訴玩家這棟每一層有哪些單位與教室。 */
function buildInfoDeskNpc(spec: BuildingSpec, w: WorldLookup): NpcSpawn {
  const directory = buildingFloors(spec)
    .map((floor) => {
      const names = w
        .area(spec.id, floor)
        .rooms.map((room) => room.name)
        .filter((name): name is string => name !== undefined);
      const units = [...new Set(names.filter((name) => !/^\d+$/.test(name)))];
      const classrooms = names.filter((name) => /^\d+$/.test(name)).sort();
      const parts = [...units];
      if (classrooms.length > 0) {
        parts.push(
          classrooms.length === 1
            ? `教室 ${classrooms[0]}`
            : `教室 ${classrooms[0]}～${classrooms[classrooms.length - 1]}`
        );
      }
      return parts.length > 0 ? `${floorLabel(floor)}：${parts.join("、")}` : undefined;
    })
    .filter((line): line is string => line !== undefined);
  const basementCount = spec.basementCount ?? 0;
  const size =
    basementCount > 0
      ? `這棟地上 ${spec.topFloor} 層、地下 ${basementCount} 層`
      : `這棟共有 ${spec.topFloor} 層`;
  const desk = w.area(spec.id, 1).building!.anchors.infoDesk;

  return {
    id: `${spec.id}-desk`,
    name: "服務台",
    paletteKey: "desk",
    kind: "fixed",
    locationLabel: `${spec.name} 1F 大廳`,
    areaId: floorAreaId(spec.id, 1),
    x: desk.x,
    y: desk.y,
    direction: desk.direction,
    greeting: `歡迎來到${spec.name}。`,
    lines: [
      `歡迎來到${spec.name}。${size}，樓梯在走廊最西邊，電梯在走廊中間。累了可以在大廳休息區坐一下。`,
      directory.length > 0 ? `樓層簡介：${directory.join("；")}。` : "這棟主要是教室和研究室。",
    ],
  };
}

/**
 * 校園世界，對應計畫書第 6 節：戶外校園地圖（依北科大校園地圖配置），加上可以進入的建築物各樓層。
 * 行政流程相關的單位都放在建築物裡的實際樓層，玩家要自己爬樓梯或搭電梯過去。
 */
export function buildCampusWorld(): { areas: Map<string, Area>; npcSpawns: NpcSpawn[] } {
  const areas = new Map<string, Area>();
  const specs: BuildingSpec[] = [];
  for (const building of BUILDINGS) {
    const spec = toBuildingSpec(building);
    if (!spec) continue;
    specs.push(spec);
    for (const floor of buildingFloors(spec)) {
      const area = buildFloorArea(spec, floor);
      areas.set(area.id, area);
    }
  }

  const lookup = new WorldLookup(areas);
  const entranceOf = (buildingId: string) => lookup.area(buildingId, 1).building!.anchors.entranceArrival;
  areas.set(OUTDOOR_AREA_ID, buildOutdoorArea(BUILDINGS, entranceOf));

  const npcSpawns = [
    ...declareQuestNpcs(lookup),
    ...declareDocumentDTeachers(lookup),
    ...declareServiceNpcs(lookup),
    ...declareHelperNpcs(lookup),
    ...specs.map((spec) => buildInfoDeskNpc(spec, lookup)),
  ];
  return { areas, npcSpawns };
}
