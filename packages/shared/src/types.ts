// Shared data model for medify.Rx. Used by the server, the web app, and the iOS app
// so a medication added from the scanner is the exact same shape as one typed in manually.

// ---------- Profile ----------

export type MedicationSource = 'manual' | 'prescription-scan';

export interface Medication {
  id: string;
  enteredName: string;
  normalizedName?: string;
  rxCui?: string;
  strength?: string;
  frequency?: string;
  route?: string;
  reason?: string;
  source: MedicationSource;
}

export type AllergyType = 'medication' | 'food' | 'other';

export interface Allergy {
  id: string;
  substance: string;
  type: AllergyType;
  reaction?: string;
  source: 'user';
}

export type FoodReason = 'regularly-consume' | 'allergy' | 'dietary-restriction';

export interface Food {
  id: string;
  name: string;
  reason: FoodReason;
}

export interface Profile {
  medications: Medication[];
  allergies: Allergy[];
  foods: Food[];
}

// ---------- Drug search (RxNorm) ----------

export interface DrugSearchResult {
  name: string;
  rxCui: string;
}

// ---------- Interaction tree ----------

export type ProfileNodeType = 'patient' | 'medication' | 'allergy' | 'food';

export interface ProfileNode {
  id: string;
  type: ProfileNodeType;
  label: string;
  metadata?: Record<string, unknown>;
}

export type RelationshipType = 'drug-drug' | 'drug-food' | 'drug-allergy' | 'contraindication';

export type RelationshipStatus =
  | 'documented'
  | 'warning'
  | 'contraindication'
  | 'possible-allergy-match';

export interface Relationship {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: RelationshipType;
  status: RelationshipStatus;
  title: string;
  explanation?: string;
  source: {
    organization: string;
    label?: string;
    url?: string;
  };
  sourceText?: string;
  checkedAt: string;
}

export interface InteractionCheckRequest {
  medications: Pick<Medication, 'enteredName' | 'normalizedName' | 'rxCui'>[];
  allergies: Pick<Allergy, 'substance' | 'type'>[];
  foods: Pick<Food, 'name'>[];
}

export interface InteractionCheckResponse {
  nodes: ProfileNode[];
  relationships: Relationship[];
  /** Always shown in the UI. "No relationship found" never means "safe". */
  disclaimer: string;
}

// ---------- Live highlighter (mobile) ----------

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnnotationCategory =
  | 'jargon'
  | 'abbreviation'
  | 'medication'
  | 'critical'
  | 'warning'
  | 'consent';

export interface Annotation {
  id: string;
  sourceText: string;
  normalizedText?: string;
  bbox: BBox;
  confidence: number;
  category: AnnotationCategory;
  /** Dosage, units, frequency, route, warnings: shown exactly, never rewritten. */
  immutable: boolean;
  explanation?: string;
  source?: string;
}

export interface ExplainRequest {
  term: string;
  context?: string;
}

export interface ExplainResponse {
  term: string;
  simpleDefinition: string;
  source: 'glossary' | 'ai' | 'none';
  needsVerification: boolean;
}

// ---------- Medication chat ----------

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatRequest {
  /** Full conversation, oldest first, ending with the patient's new message. Nothing is stored server-side. */
  messages: ChatMessage[];
  /** The patient's current profile, as context. Patient-entered, so unverified. */
  profile?: {
    medications: Pick<Medication, 'enteredName' | 'normalizedName' | 'strength' | 'frequency'>[];
    allergies: Pick<Allergy, 'substance'>[];
  };
}

/** Server-sent events on the /api/chat stream. `done.text` is the full reply and may differ from the streamed text. */
export type ChatStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'done'; text: string }
  | { type: 'error'; message: string };
