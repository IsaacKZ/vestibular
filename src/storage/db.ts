import Dexie, { type Table } from "dexie";
import type {
  QuestionRevision,
  StudySession,
  DraftRecord,
  Attempt,
  Grade,
  FeedbackEvent,
  Gap,
  Review,
  Settings,
  DailyPlan,
} from "../content/types";
export interface SubmissionReceipt {
  submissionId: string;
  attemptId: string;
  payloadHash: string;
}
export interface SettingsRecord {
  id: "current";
  value: Settings;
}
export class StudyDb extends Dexie {
  questionSnapshots!: Table<QuestionRevision, [string, string]>;
  sessions!: Table<StudySession, string>;
  drafts!: Table<DraftRecord, [string, string]>;
  attempts!: Table<Attempt, string>;
  grades!: Table<Grade, string>;
  feedback!: Table<FeedbackEvent, string>;
  gaps!: Table<Gap, string>;
  reviews!: Table<Review, string>;
  settings!: Table<SettingsRecord, string>;
  plans!: Table<DailyPlan, string>;
  submissionReceipts!: Table<SubmissionReceipt, string>;
  constructor(name = "udesc-study") {
    super(name);
    this.version(1).stores({
      questionSnapshots: "[id+revision],id",
      sessions: "id,status,mode",
      drafts: "[sessionId+questionId],sessionId",
      attempts: "id,&submissionId,sessionId,questionId,at",
      grades: "id,attemptId,[attemptId+decisionRevision]",
      feedback: "id,attemptId,questionId,at",
      gaps: "questionId,status",
      reviews: "questionId,dueDate",
      settings: "id",
      plans: "date",
      submissionReceipts: "submissionId,attemptId",
    });
  }
}
export const db = new StudyDb();
