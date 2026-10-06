import { liveQuery } from "dexie";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  DailyPlan,
  LearningHistory,
  LearningProjection,
  QuestionRevision,
  Settings,
  Subject,
} from "../content/types";
import { defaultSettings, emptyHistory } from "../content/constants";
import { QuestionRevisionSchema } from "../content/schema";
import { db } from "../storage/db";
import {
  getSettings,
  loadHistory,
  loadProjection,
} from "../storage/study-service";
export interface Audit {
  total: number;
  ready: number;
  flags: {
    ocr: number;
    uncertain: number;
    blocked: number;
    candidates: number;
  };
  historicalFrequency: {
    label: string;
    sampleSize: number;
    editions: string[];
    uncertainClassifications: number;
    topics: {
      subject: Subject;
      topic: string;
      total: number;
      proofs: number;
      distribution: number[];
    }[];
  };
}
interface AppState {
  catalogue: QuestionRevision[];
  snapshots: QuestionRevision[];
  audit: Audit | null;
  history: LearningHistory;
  projection: LearningProjection;
  settings: Settings;
  plans: DailyPlan[];
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  findQuestion: (id: string) => QuestionRevision | undefined;
}
const Context = createContext<AppState | null>(null);
export const now = () => new Date().toISOString();
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
export function AppProvider({ children }: { children: ReactNode }) {
  const [catalogue, setCatalogue] = useState<QuestionRevision[]>([]),
    [snapshots, setSnapshots] = useState<QuestionRevision[]>([]),
    [audit, setAudit] = useState<Audit | null>(null);
  const [history, setHistory] = useState<LearningHistory>(emptyHistory),
    [projection, setProjection] = useState<LearningProjection>({
      gaps: [],
      reviews: [],
    }),
    [settings, setSettings] = useState(defaultSettings),
    [plans, setPlans] = useState<DailyPlan[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const [h, p, s, q, pl] = await Promise.all([
      loadHistory(db),
      loadProjection(db),
      getSettings(db),
      db.questionSnapshots.toArray(),
      db.plans.toArray(),
    ]);
    setHistory(h);
    setProjection(p);
    setSettings(s);
    setSnapshots(q);
    setPlans(pl);
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh();
        const responses = await Promise.all(
          ["catalog", "questions", "audit"].map((name) =>
            fetch(`${import.meta.env.BASE_URL}content/${name}.json`),
          ),
        );
        if (responses.some((r) => !r.ok))
          throw new Error(
            "O acervo ainda precisa de conexão. Reabra o app quando estiver online.",
          );
        const [raw, ready, a] = await Promise.all(
          responses.map((r) => r.json()),
        );
        const items = QuestionRevisionSchema.array().parse(raw),
          verified = QuestionRevisionSchema.array().parse(ready);
        const merged = new Map(items.map((q) => [q.id, q]));
        verified.forEach((q) => merged.set(q.id, q));
        if (alive) {
          setCatalogue([...merged.values()]);
          setAudit(a);
        }
      } catch (e) {
        if (alive) setError(errorMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);
  useEffect(() => {
    const subscription = liveQuery(() =>
      Promise.all([
        loadHistory(db),
        loadProjection(db),
        getSettings(db),
        db.questionSnapshots.toArray(),
        db.plans.toArray(),
      ]),
    ).subscribe({
      next: ([h, p, s, q, pl]) => {
        setHistory(h);
        setProjection(p);
        setSettings(s);
        setSnapshots(q);
        setPlans(pl);
      },
      error: (e) => setError(errorMessage(e)),
    });
    return () => subscription.unsubscribe();
  }, []);
  const findQuestion = (id: string) =>
    catalogue.find((q) => q.id === id) ?? snapshots.find((q) => q.id === id);
  return (
    <Context.Provider
      value={{
        catalogue,
        snapshots,
        audit,
        history,
        projection,
        settings,
        plans,
        loading,
        error,
        refresh,
        findQuestion,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStudy() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider ausente");
  return value;
}
