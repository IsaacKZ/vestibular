import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "./ui/AppContext";
import { AppShell } from "./ui/AppShell";
import { TodayPage } from "./features/today/TodayPage";
import { CataloguePage } from "./features/catalogue/CataloguePage";
import { QuestionDetails } from "./features/catalogue/QuestionDetails";
import { PracticePage } from "./features/practice/PracticePage";
import { NotebookPage } from "./features/notebook/NotebookPage";
import { ProgressPage } from "./features/progress/ProgressPage";
import { AssessmentPage } from "./features/assessment/AssessmentPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import "katex/dist/katex.min.css";
import "./styles/tokens.css";
import "./styles/global.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<TodayPage />} />
            <Route path="questions" element={<CataloguePage />} />
            <Route path="questions/:questionId" element={<QuestionDetails />} />
            <Route path="practice/:sessionId" element={<PracticePage />} />
            <Route path="assessment" element={<AssessmentPage />} />
            <Route path="assessment/:sessionId" element={<PracticePage />} />
            <Route path="notebook" element={<NotebookPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route
              path="questoes"
              element={<Navigate to="/questions" replace />}
            />
            <Route
              path="caderno"
              element={<Navigate to="/notebook" replace />}
            />
            <Route
              path="progresso"
              element={<Navigate to="/progress" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
