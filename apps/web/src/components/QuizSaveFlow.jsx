import SaveFlow from "./SaveFlow";
import { claimQuizResult } from "../lib/apiClient";

export default function QuizSaveFlow({ resultId, sessionId, active }) {
  return (
    <SaveFlow
      itemId={sessionId ? resultId : null}
      save={async (getIdToken) => claimQuizResult(await getIdToken(), resultId, sessionId)}
      savedText="Quiz result saved to your profile"
      errorText="Couldn't save your quiz result."
      modalTitle="Keep your result"
      modalBody="Create a free account to save this match to your profile, add your pet and get care reminders."
      next="/quiz"
      active={active}
    />
  );
}
