"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { purchaseCost } from "@/lib/pricing/engine";
import { loadHaul, loadSettings, saveHaul, saveSettings, type HaulItem } from "@/lib/storage";
import type { CheckResponse, PriceCheckResult, Settings, Turn } from "@/lib/types";
import { useSpeech } from "@/lib/useSpeech";
import { CompsPanel, HaulPanel, SettingsPanel } from "./Panels";
import { ResultCard, itemName } from "./ResultCard";

type Panel = null | "comps" | "haul" | "settings";

export function SourcerApp() {
  const speech = useSpeech();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [haul, setHaul] = useState<HaulItem[]>([]);
  const [conversation, setConversation] = useState<Turn[]>([]);
  const [followUpsAsked, setFollowUpsAsked] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState<PriceCheckResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [typed, setTyped] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // localStorage is only available after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettings());
    setHaul(loadHaul());
  }, []);

  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Show the verdict from its top; otherwise follow the conversation.
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation, result, thinking, speech.interim]);

  // Latest-state refs so the speech callbacks never see stale values.
  const stateRef = useRef({ conversation, followUpsAsked, settings, result });
  useEffect(() => {
    stateRef.current = { conversation, followUpsAsked, settings, result };
  }, [conversation, followUpsAsked, settings, result]);

  const submitRef = useRef<(text: string) => void>(() => {});
  /** Bumped on every submit/reset so stale speech callbacks can tell they're out of date. */
  const turnRef = useRef(0);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const turn = ++turnRef.current;
      speech.cancel();
      const prev = stateRef.current;
      const fresh = prev.result !== null; // a new item after a verdict starts a new conversation
      const nextConversation: Turn[] = [...(fresh ? [] : prev.conversation), { role: "sourcer", text: trimmed }];
      const asked = fresh ? 0 : prev.followUpsAsked;

      setConversation(nextConversation);
      setFollowUpsAsked(asked);
      setResult(null);
      setSaved(false);
      setError(null);
      setThinking(true);

      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation: nextConversation, followUpsAsked: asked, settings: prev.settings }),
        });
        const data = (await res.json()) as CheckResponse;
        if (data.kind === "error") {
          setError(data.message);
        } else if (data.kind === "followup") {
          setConversation([...nextConversation, { role: "assistant", text: data.question }]);
          setFollowUpsAsked(asked + 1);
          // Hands-free: listen for the answer as soon as the question finishes.
          speech.speak(data.question, () => {
            if (turnRef.current === turn) speech.listen((t) => submitRef.current(t));
          });
        } else {
          setResult(data.result);
          speech.speak(data.result.spoken);
        }
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setThinking(false);
      }
    },
    [speech],
  );
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const onMic = () => {
    speech.unlockAudio();
    if (speech.listening) {
      speech.stop();
      return;
    }
    window.speechSynthesis?.cancel();
    if (!speech.listen((t) => submitRef.current(t))) {
      document.getElementById("typed-input")?.focus();
    }
  };

  const onTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    speech.unlockAudio();
    const t = typed;
    setTyped("");
    void submit(t);
  };

  const reset = () => {
    turnRef.current++;
    speech.cancel();
    window.speechSynthesis?.cancel();
    setConversation([]);
    setFollowUpsAsked(0);
    setResult(null);
    setSaved(false);
    setError(null);
  };

  const saveToHaul = () => {
    if (!result) return;
    const rec = result.platforms.find((p) => p.platform === result.recommendedPlatform);
    const item: HaulItem = {
      id: crypto.randomUUID(),
      name: itemName(result),
      tagPrice: result.item.tagPrice,
      purchaseCost: result.item.tagPrice == null ? null : purchaseCost(result.item.tagPrice, settings),
      netProfit: rec?.netProfit ?? 0,
      platform: result.recommendedPlatform,
      verdict: result.verdict,
      savedAt: new Date().toISOString(),
    };
    const next = [item, ...haul];
    setHaul(next);
    saveHaul(next);
    setSaved(true);
  };

  const updateSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  const idle = conversation.length === 0 && !result && !thinking && !speech.listening;

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col">
      <header className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <button onClick={reset} className="text-lg font-bold tracking-tight">
          {APP_NAME}
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPanel("haul")}
            className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium active:bg-surface-2"
          >
            <BagIcon />
            Haul
            {haul.length > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-xs text-accent-text">{haul.length}</span>
            )}
          </button>
          <button
            onClick={() => setPanel("settings")}
            aria-label="Settings"
            className="h-10 w-10 rounded-full active:bg-surface-2"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {idle && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-2xl font-semibold tracking-tight">What did you find?</p>
            <p className="mt-2 text-muted">Tap the mic and describe it, with the tag price if there is one.</p>
            <p className="mt-6 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted italic">
              “Patagonia Synchilla, men’s large, nine bucks”
            </p>
          </div>
        )}

        {conversation.map((t, i) => (
          <Bubble key={i} role={t.role}>
            {t.text}
          </Bubble>
        ))}
        {speech.listening && <Bubble role="sourcer">{speech.interim || "Listening…"}</Bubble>}
        {thinking && <Bubble role="assistant">Checking sold prices…</Bubble>}
        {error && <p className="rounded-2xl bg-pass-bg px-4 py-3 text-sm text-pass">{error}</p>}
        {speech.error && <p className="rounded-2xl bg-pass-bg px-4 py-3 text-sm text-pass">{speech.error}</p>}

        {result && (
          <div ref={resultRef} className="scroll-mt-3">
            <ResultCard
              result={result}
              homePlatform={settings.homePlatform}
              saved={saved}
              onWhy={() => setPanel("comps")}
              onSave={saveToHaul}
              onNew={reset}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-bg px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="flex items-center gap-3">
          <form onSubmit={onTypedSubmit} className="flex flex-1 items-center">
            <input
              id="typed-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={speech.supported ? "Or type it…" : "Type the item…"}
              enterKeyHint="send"
              autoComplete="off"
              className="h-12 w-full rounded-full border border-border bg-surface px-4 text-base outline-none focus:border-accent"
            />
          </form>
          <button
            onClick={onMic}
            disabled={thinking}
            aria-label={speech.listening ? "Stop listening" : "Start talking"}
            className={`grid size-[72px] shrink-0 place-items-center rounded-full bg-accent text-accent-text shadow-md transition active:scale-95 disabled:opacity-50 ${
              speech.listening ? "listening-pulse" : ""
            }`}
          >
            {speech.listening ? <StopIcon /> : <MicIcon />}
          </button>
        </div>
      </footer>

      {panel === "comps" && result && <CompsPanel result={result} onClose={() => setPanel(null)} />}
      {panel === "haul" && (
        <HaulPanel
          items={haul}
          onRemove={(id) => {
            const next = haul.filter((i) => i.id !== id);
            setHaul(next);
            saveHaul(next);
          }}
          onClear={() => {
            setHaul([]);
            saveHaul([]);
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "settings" && (
        <SettingsPanel settings={settings} onChange={updateSettings} onClose={() => setPanel(null)} />
      )}
    </div>
  );
}

function Bubble({ role, children }: { role: Turn["role"]; children: React.ReactNode }) {
  const mine = role === "sourcer";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-base leading-snug ${
          mine ? "rounded-br-lg bg-accent text-accent-text" : "rounded-bl-lg bg-surface-2"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

const MicIcon = () => (
  <svg
    width="30"
    height="30"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden
  >
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);
const StopIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);
const GearIcon = () => (
  <svg
    className="mx-auto"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
const BagIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M6 7h12l1 14H5L6 7z" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
);
