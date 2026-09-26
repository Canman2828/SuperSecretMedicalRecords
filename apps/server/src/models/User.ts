import mongoose, { Schema, type InferSchemaType } from 'mongoose';

// Hackathon choice: medications/allergies/foods are embedded in the user document.
// Simple to save/load as one profile; split into separate collections later if needed.

const medicationSchema = new Schema(
  {
    id: { type: String, required: true },
    enteredName: { type: String, required: true },
    normalizedName: String,
    rxCui: String,
    strength: String,
    frequency: String,
    route: String,
    reason: String,
    source: { type: String, enum: ['manual', 'prescription-scan'], default: 'manual' },
  },
  { _id: false, timestamps: true },
);

const allergySchema = new Schema(
  {
    id: { type: String, required: true },
    substance: { type: String, required: true },
    type: { type: String, enum: ['medication', 'food', 'other'], default: 'medication' },
    reaction: String,
    source: { type: String, enum: ['user'], default: 'user' },
  },
  { _id: false, timestamps: true },
);

const foodSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    reason: {
      type: String,
      enum: ['regularly-consume', 'allergy', 'dietary-restriction'],
      default: 'regularly-consume',
    },
  },
  { _id: false, timestamps: true },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    // Password reset: only a SHA-256 hash of the emailed token is stored, so a database leak can't be used to reset.
    resetTokenHash: { type: String, select: false, index: { sparse: true } },
    resetTokenExpires: { type: Date, select: false },
    profile: {
      medications: { type: [medicationSchema], default: [] },
      allergies: { type: [allergySchema], default: [] },
      foods: { type: [foodSchema], default: [] },
    },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = mongoose.model('User', userSchema);
