import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireDb, type AuthedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { MedDocumentModel, type MedDocumentDoc } from '../models/MedDocument.js';
import { documentSchema } from '../schemas.js';

// Saved documents belong to a signed-in account, so both a DB and a valid token are required.
export const documentsRouter = Router();
documentsRouter.use(requireDb, requireAuth);

function toDocument(d: MedDocumentDoc & { _id: unknown; createdAt?: Date }) {
  return {
    id: String(d._id),
    imageBase64: d.imageBase64,
    mimeType: d.mimeType,
    plainText: d.plainText,
    originalText: d.originalText ?? undefined,
    docType: d.docType ?? undefined,
    createdAt: (d.createdAt ?? new Date()).toISOString(),
  };
}

// POST /api/documents — save a photographed document + its plain-language text to the account.
documentsRouter.post('/', validateBody(documentSchema), async (req: AuthedRequest, res) => {
  const doc = await MedDocumentModel.create({ ...req.body, userId: req.userId });
  res.status(201).json(toDocument(doc.toObject()));
});

// GET /api/documents — the signed-in user's saved documents, newest first.
documentsRouter.get('/', async (req: AuthedRequest, res) => {
  const docs = await MedDocumentModel.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
  res.json({ documents: docs.map(toDocument) });
});

// DELETE /api/documents/:id — remove one saved document (photo and text) owned by this user.
documentsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Document not found' });
  const result = await MedDocumentModel.deleteOne({ _id: req.params.id, userId: req.userId });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Document not found' });
  res.json({ ok: true });
});
