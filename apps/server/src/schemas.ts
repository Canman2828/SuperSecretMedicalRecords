import { z } from 'zod';

export const medicationSchema = z.object({
  id: z.string().min(1),
  enteredName: z.string().min(1).max(200),
  normalizedName: z.string().max(200).optional(),
  rxCui: z.string().max(20).optional(),
  strength: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  route: z.string().max(100).optional(),
  reason: z.string().max(300).optional(),
  source: z.enum(['manual', 'prescription-scan']),
});

export const allergySchema = z.object({
  id: z.string().min(1),
  substance: z.string().min(1).max(200),
  type: z.enum(['medication', 'food', 'other']),
  reaction: z.string().max(200).optional(),
  source: z.literal('user'),
});

export const foodSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  reason: z.enum(['regularly-consume', 'allergy', 'dietary-restriction']),
});

export const profileSchema = z.object({
  medications: z.array(medicationSchema).max(100),
  allergies: z.array(allergySchema).max(100),
  foods: z.array(foodSchema).max(100),
});

export const interactionCheckSchema = z.object({
  medications: z
    .array(
      z.object({
        enteredName: z.string().min(1),
        normalizedName: z.string().optional(),
        rxCui: z.string().optional(),
      }),
    )
    .max(100),
  allergies: z.array(z.object({ substance: z.string().min(1), type: z.enum(['medication', 'food', 'other']) })).max(100),
  foods: z.array(z.object({ name: z.string().min(1) })).max(100),
});

export const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(40)
    .refine((msgs) => msgs.every((m, i) => m.role === (i % 2 === 0 ? 'user' : 'assistant')), {
      message: 'Messages must alternate, starting and ending with the patient.',
    })
    .refine((msgs) => msgs.length % 2 === 1, {
      message: 'Messages must alternate, starting and ending with the patient.',
    }),
  profile: z
    .object({
      medications: z
        .array(
          z.object({
            enteredName: z.string().min(1).max(200),
            normalizedName: z.string().max(200).optional(),
            strength: z.string().max(100).optional(),
            frequency: z.string().max(100).optional(),
          }),
        )
        .max(100),
      allergies: z.array(z.object({ substance: z.string().min(1).max(200) })).max(100),
    })
    .optional(),
});

export const explainSchema = z.object({
  term: z.string().min(1).max(100),
  context: z.string().max(1000).optional(),
});

export const translateSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  language: z.string().trim().min(1).max(40).optional(),
  knownMedications: z.array(z.string().min(1).max(200)).max(100).optional(),
  /** 'summary' keeps only the medical instructions; 'faithful' (default) rewrites everything. */
  mode: z.enum(['faithful', 'summary']).optional(),
});

export const medicationUsesSchema = z
  .object({
    medications: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
    text: z.string().trim().min(1).max(4000).optional(),
  })
  .refine((b) => b.medications?.length || b.text, { message: 'Send medications or scanned text.' });
