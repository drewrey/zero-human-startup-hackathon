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

  it("understands the home-screen example, including curly quotes and model names", () => {
    const { item, followUpQuestion } = understandWithHeuristics(say("“Patagonia Synchilla, men’s large, nine bucks”"), true);
    expect(item).toMatchObject({
      brand: "Patagonia",
      variant: "Synchilla",
      type: "fleece pullover",
      size: "L",
      gender: "men",
      tagPrice: 9,
    });
    expect(followUpQuestion).toBeNull();
  });

  it("never asks the same question twice", () => {
    const conversation = [
      { role: "sourcer" as const, text: "Patagonia thing, large" },
      { role: "assistant" as const, text: "What kind of item?" },
      { role: "sourcer" as const, text: "the retro one" },
    ];
    expect(understandWithHeuristics(conversation, true).followUpQuestion).toBeNull();
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

  it.each([
    ["ninety bucks", 90], ["sixty bucks", 60], ["seventy dollars", 70], ["eighty bucks", 80],
    ["a hundred bucks", 100], ["one hundred dollars", 100], ["one twenty bucks", 120],
    ["ninety-nine bucks", 99], ["one hundred and five bucks", 105], ["forty two bucks", 42],
  ])("BR-1 parses spoken price %s", (phrase, price) => {
    expect(understandWithHeuristics(say(`some fleece jacket ${phrase}`), true).item.tagPrice).toBe(price);
  });

  it("BR-1 keeps ninety as the tag price for the Synchilla", () => {
    const { item } = understandWithHeuristics(say("Patagonia Synchilla, men's large, ninety bucks"), true);
    expect(item.tagPrice).toBe(90);
  });
});
