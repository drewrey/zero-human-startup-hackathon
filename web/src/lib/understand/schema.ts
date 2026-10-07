import { z } from "zod";

export const ItemAttributesSchema = z.object({
  brand: z.string().nullable(),
  type: z.string().nullable(),
  variant: z.string().nullable(),
  size: z.string().nullable(),
  gender: z.enum(["men", "women", "unisex", "kids"]).nullable(),
  condition: z.enum(["new_with_tags", "excellent", "good", "fair", "poor"]).nullable(),
  flaws: z.string().nullable(),
  era: z.string().nullable(),
  tagPrice: z.number().nullable(),
});

export const UnderstandingSchema = z.object({
  item: ItemAttributesSchema,
  /** Defaults we filled in, phrased for the card, e.g. "condition: good". */
  assumptions: z.array(z.string()),
  /** One short spoken question, or null when we can price now. */
  followUpQuestion: z.string().nullable(),
});

export type Understanding = z.infer<typeof UnderstandingSchema>;
