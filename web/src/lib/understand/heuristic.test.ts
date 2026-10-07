import { describe, expect, it } from "vitest";
import { understandWithHeuristics } from "./heuristic";

const say = (...texts: string[]) => texts.map((text) => ({ role: "sourcer" as const, text }));

describe("heuristic understanding", () => {
  it("parses brand, type, size, gender, and a spoken price", () => {
    const { item, followUpQuestion } = understandWithHeuristics(say("Patagonia men's fleece, large, nine bucks"), true);
    expect(item).toMatchObject({ brand: "Patagonia", type: "fleece", size: "L", gender: "men", tagPrice: 9 });
    expect(followUpQuestion).toBeNull();
  });

  it("parses spoken prices mid-sentence, including compound numbers", () => {
    expect(understandWithHeuristics(say("some fleece jacket nine bucks"), true).item.tagPrice).toBe(9);
    expect(understandWithHeuristics(say("coach bag twenty five dollars"), true).item.tagPrice).toBe(25);
    expect(understandWithHeuristics(say("levis jeans $7.99"), true).item.tagPrice).toBe(7.99);
  });

  it("does not read the s in men's as a size", () => {
    expect(understandWithHeuristics(say("Patagonia men's fleece"), true).item.size).toBeNull();
  });

  it("asks for missing price-relevant details, combining at most two", () => {
    const { followUpQuestion } = understandWithHeuristics(say("some jacket, $12"), true);
    expect(followUpQuestion).toBe("What brand is it? What size?");
  });

  it("BR-6: asks nothing once follow-ups are used up", () => {
    expect(understandWithHeuristics(say("some jacket"), false).followUpQuestion).toBeNull();
  });
});
