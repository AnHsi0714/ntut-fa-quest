/** 地圖上的圖塊種類，對應計畫書第 6 節的校園地圖元素（戶外 + 建築物樓層內部）。 */
export enum TileType {
  Grass = "grass",
  Path = "path",
  Plaza = "plaza",
  Wall = "wall",
  /**
   * 各棟建築物的外牆材質，參考北科大臺北校區整體發展研究對各時期建築語彙的整理：
   * 紅樓是清水紅磚；三教是黃色丁掛面磚；行政大樓、圖書館、綜合科館是黃色二丁掛面磚加灰色玻璃馬賽克；
   * 光復初期（新生南路軸線、四教、化學館）是洗石子。科研大樓的玻璃帷幕與其他棟的清水混凝土是遊戲設定。
   */
  WallRedBrick = "wallRedBrick",
  WallYellowTile = "wallYellowTile",
  WallTanMosaic = "wallTanMosaic",
  WallWashedStone = "wallWashedStone",
  WallGlass = "wallGlass",
  WallConcrete = "wallConcrete",
  Door = "door",
  Border = "border",
  /** 校外馬路（忠孝東路、新生南路、建國南路），只是背景，不能走上去。 */
  Road = "road",
  /** 忠孝東路上的人行穿越道，讓玩家可以從正校門過馬路走到對面的先鋒大樓。 */
  Crosswalk = "crosswalk",
  /** 建國南路上的人行穿越道（東西向過馬路，斑馬線是直的），連接建國側門與東校區。 */
  CrosswalkVertical = "crosswalkVertical",
  /** 東校區的網球場、籃球場，可以走。 */
  Court = "court",
  /** 東校區運動場的跑道，可以走。 */
  Track = "track",
  /** 校門口的地面，可以走。 */
  Gate = "gate",
  /** 建築物內部：地板、牆壁、樓梯、電梯、出口。 */
  Floor = "floor",
  InteriorWall = "interiorWall",
  Stairs = "stairs",
  Elevator = "elevator",
  Exit = "exit",
  /** 1F 大廳的休息區沙發：面對它按互動鍵可以坐下來休息、補一點體力。 */
  Bench = "bench",
  /** 環形建築（三教）中間鏤空的挑空：2F 以上往下看得到中庭，不能走。 */
  Atrium = "atrium",
  /** 環形建築 1F 中間的中庭，可以走（只有 2F 以上才是鏤空）。 */
  Courtyard = "courtyard",
}

/** 玩家 / NPC 是否可以走上這個圖塊。樓梯與電梯要面對它按互動鍵使用，本身不能站上去。 */
export function isTileWalkable(tile: TileType): boolean {
  switch (tile) {
    case TileType.Grass:
    case TileType.Path:
    case TileType.Plaza:
    case TileType.Door:
    case TileType.Gate:
    case TileType.Floor:
    case TileType.Exit:
    case TileType.Courtyard:
    case TileType.Crosswalk:
    case TileType.CrosswalkVertical:
    case TileType.Court:
    case TileType.Track:
      return true;
    case TileType.Wall:
    case TileType.WallRedBrick:
    case TileType.WallYellowTile:
    case TileType.WallTanMosaic:
    case TileType.WallWashedStone:
    case TileType.WallGlass:
    case TileType.WallConcrete:
    case TileType.Bench:
    case TileType.Atrium:
    case TileType.Border:
    case TileType.Road:
    case TileType.InteriorWall:
    case TileType.Stairs:
    case TileType.Elevator:
      return false;
  }
}
