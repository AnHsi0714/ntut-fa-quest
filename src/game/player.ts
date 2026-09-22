import { Entity } from "./entity";
import { buildCharacterSpriteSet, PLAYER_PALETTE } from "./pixelSprite";

export class Player extends Entity {
  constructor(tileX: number, tileY: number) {
    super(tileX, tileY, buildCharacterSpriteSet(PLAYER_PALETTE));
  }
}
