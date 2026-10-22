import { useEffect, useState } from "react";
import { StepTransition } from "../motion/PageTransition.jsx";
import RiddleQuestion from "./RiddleQuestion.jsx";
import RiddleSolved from "./RiddleSolved.jsx";
import { answerRiddle, getTodayRiddles } from "../../api/riddles.js";
import { markAnswered, withAnswered } from "./answeredStore.js";

export default function RiddleFlow({ accent, onClose, onUpdated }) {
  const [riddles, setRiddles] = useState([]);
  const [availableResonators, setAvailableResonators] = useState(null);
  const [day, setDay] = useState(null);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState("loading");
  const [reward, setReward] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      setError("");
      const data = await getTodayRiddles();
      const today = withAnswered(data);
      setDay(data?.day);
      setRiddles(today);
      setAvailableResonators(data?.available_resonators ?? null);
      const firstUnsolved = today.findIndex((r) => !r.answered);
      if (firstUnsolved === -1) setStep("complete");
      else {
        setIndex(firstUnsolved);
        setStep("question");
      }
    } catch (err) {
      setError(err.message || "Failed to load today's riddles.");
      setStep("error");
    }
  };

  useEffect(() => { load(); }, []);

  const current = riddles[index];

  const submit = async (answer) => {
    if (!current || submitting) return null;
    setSubmitting(true);
    try {
      const result = await answerRiddle(current.id, answer);
      markAnswered(day, current.id);
      setRiddles((prev) => prev.map((r, i) => i === index ? { ...r, answered: true, solved: !!result.correct } : r));
      if (!result.correct) {
        // wrong answer: no retry, move straight to the next unanswered riddle
        const next = riddles.findIndex((r, i) => i !== index && !r.answered);
        if (next !== -1) setIndex(next);
        else setStep("complete");
        onUpdated?.(result);
        return result;
      }

      setAvailableResonators(result.available_resonators ?? availableResonators);
      setReward(result);
      setStep("solved");
      onUpdated?.(result);
      return result;
    } catch (err) {
      setError(err.message || "Unable to submit answer.");
      setStep("error");
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const continueAfterSolve = () => {
    const next = riddles.findIndex((r, i) => i !== index && !r.answered);
    if (next !== -1) {
      setIndex(next);
      setStep("question");
      setReward(null);
    } else {
      setStep("complete");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#05060b] text-white">
      <StepTransition id={`${step}-${index}`} className="h-full">
      {step === "loading" && <div className="grid h-full place-items-center text-sm text-mute">Loading today's riddles…</div>}

      {step === "error" && (
        <div className="grid h-full place-items-center px-6 text-center">
          <div>
            <p className="font-display text-xl font-bold">Riddles unavailable</p>
            <p className="mt-2 text-sm text-mute">{error}</p>
            <button className="mt-5 rounded-lg border border-white/15 px-4 py-2 text-sm" onClick={load}>Try again</button>
          </div>
        </div>
      )}

      {step === "question" && current && (
        <RiddleQuestion
          question={current}
          accent={accent}
          index={index + 1}
          total={riddles.length || 2}
          onBack={onClose}
          onSubmit={submit}
          submitting={submitting}
        />
      )}

      {step === "solved" && (
        <RiddleSolved
          accent={accent}
          xp={reward?.xp?.awarded ?? 100}
          resonator={reward?.resonator_granted ?? 1}
          onBack={onClose}
          onContinue={continueAfterSolve}
        />
      )}

      {step === "complete" && (
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto px-6 pt-[max(2rem,env(safe-area-inset-top))] text-center">
            <div className="mx-auto mt-16 grid h-24 w-24 place-items-center rounded-full border border-white/15 bg-white/[0.04]">
              <span className="font-display text-3xl font-black">✓</span>
            </div>
            <h1 className="mt-6 font-display text-3xl font-bold">Daily riddles complete</h1>
            <p className="mt-2 text-sm leading-6 text-mute">
              {riddles.filter((r) => r.solved).length === 0
                ? "No correct answers today, so no resonators earned. Come back tomorrow."
                : `You got ${riddles.filter((r) => r.solved).length} of ${riddles.length} right and earned ${riddles.filter((r) => r.solved).length} resonator${riddles.filter((r) => r.solved).length === 1 ? "" : "s"}.`}
            </p>
            {availableResonators != null && <p className="mt-6 font-display text-lg font-bold">{availableResonators} resonator{availableResonators === 1 ? "" : "s"} available</p>}
          </div>
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button onClick={onClose} className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 font-display font-bold">Back to game</button>
          </div>
        </div>
      )}
      </StepTransition>
    </div>
  );
}