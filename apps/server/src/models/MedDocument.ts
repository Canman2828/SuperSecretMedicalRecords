import mongoose, { Schema, type InferSchemaType } from 'mongoose';

// A document a user photographed in Compremedic and chose to save to their account:
// the photo (base64, stored in Mongo per the project's storage choice) plus the
// plain-language text read from it. Deleting the record deletes the photo with it.
const medDocumentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    docType: String,
    // The plain-language rewrite shown beside the original — the "plain words" we save.
    plainText: { type: String, required: true },
    originalText: String,
    // Photo bytes, base64-encoded (no data: prefix). Kept in Mongo, not an external bucket.
    imageBase64: { type: String, required: true },
    mimeType: { type: String, default: 'image/jpeg' },
  },
  { timestamps: true },
);

export type MedDocumentDoc = InferSchemaType<typeof medDocumentSchema>;
export const MedDocumentModel = mongoose.model('MedDocument', medDocumentSchema);
