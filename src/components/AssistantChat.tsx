import { useState, type FormEvent } from 'react';
import { askCopilot } from '../api/aurarouteClient.ts';
import type { ChatTurn, TelemetryPayload, UserContext } from '../shared/types.ts';
import { Bot, Send, Sparkles } from 'lucide-react';

interface AssistantChatProps {
  telemetry: TelemetryPayload;
  context: UserContext;
}

interface DisplayMessage extends ChatTurn {
  engineLabel?: string;
}

const QUICK_PROMPTS = [
  'Should I leave now or wait for a better window?',
  'What precautions does my persona need right now?',
  'How do air quality and weather affect my travel mode?',
];

export function AssistantChat({ telemetry, context }: AssistantChatProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendQuestion = async (questionText: string) => {
    const clean = questionText.trim();
    if (!clean || loading) return;

    setError(null);
    const nextHistory: DisplayMessage[] = [...messages, { role: 'user', content: clean }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await askCopilot({
        question: clean,
        context,
        telemetry,
        history: nextHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      });

      const label =
        res.engine === 'netlify-ai-gateway-gemini'
          ? `Gemini (${res.model || 'AI Gateway'})`
          : 'Deterministic Context Engine';

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer,
          engineLabel: label,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendQuestion(input);
  };

  return (
    <section
      aria-label="Dynamic AI copilot"
      className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-sky-400" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-white">AuraRoute Dynamic Copilot</h2>
            <p className="text-xs text-slate-400">
              Ask context-aware follow-ups grounded in live {telemetry.location.name} conditions.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
          <Sparkles className="w-3 h-3 text-sky-400" aria-hidden="true" />
          Live Context
        </span>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={loading}
            onClick={() => void sendQuestion(q)}
            className="text-xs px-3 py-1.5 rounded-full bg-slate-950 border border-slate-700 text-slate-200 hover:border-sky-500 hover:text-sky-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div
        className="space-y-3 max-h-[340px] overflow-y-auto pr-1"
        aria-live="polite"
        aria-label="Conversation history"
      >
        {messages.length === 0 && (
          <div className="text-xs text-slate-400 bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
            Try a quick prompt above or ask anything about timing, protective gear, route mode, or health risk for{' '}
            <strong className="text-slate-200">{telemetry.location.name}</strong>.
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-sky-500/15 border border-sky-500/30 text-sky-100 ml-6'
                : 'bg-slate-950 border border-slate-800 text-slate-200 mr-2'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span className="font-semibold uppercase tracking-wider">
                {msg.role === 'user' ? 'You' : 'AuraRoute AI'}
              </span>
              {msg.engineLabel && <span>{msg.engineLabel}</span>}
            </div>
            <div>{msg.content}</div>
          </div>
        ))}

        {loading && (
          <div className="text-xs text-sky-300 animate-pulse">
            Analyzing live telemetry and context constraints...
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="copilot-input" className="sr-only">
          Ask AuraRoute AI
        </label>
        <input
          id="copilot-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask e.g. 'Is it safe to cycle at 6 PM?'"
          maxLength={600}
          className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-semibold text-sm hover:bg-sky-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          Ask
        </button>
      </form>
    </section>
  );
}
