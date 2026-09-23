import { describe, expect, it } from "vitest";
import { StaminaSystem } from "./staminaSystem";

describe("StaminaSystem", () => {
  it("預設滿體力，且未耗盡", () => {
    const stamina = new StaminaSystem();
    expect(stamina.current).toBe(stamina.max);
    expect(stamina.isDepleted).toBe(false);
  });

  it("consume 會扣減體力，最低不會低於 0", () => {
    const stamina = new StaminaSystem();
    stamina.consume(stamina.max - 1);
    expect(stamina.current).toBe(1);
    expect(stamina.isDepleted).toBe(false);

    stamina.consume(10);
    expect(stamina.current).toBe(0);
    expect(stamina.isDepleted).toBe(true);
  });

  it("restore 會補回體力，最高不會超過上限", () => {
    const stamina = new StaminaSystem();
    stamina.consume(50);
    stamina.restore(10);
    expect(stamina.current).toBe(stamina.max - 40);

    stamina.restore(1000);
    expect(stamina.current).toBe(stamina.max);
  });
});
