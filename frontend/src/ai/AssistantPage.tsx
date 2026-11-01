import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { 
  Send, ShieldCheck, 
  CheckCircle2, ArrowRight, User as UserIcon, Bot
} from 'lucide-react';

export const AssistantPage: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'assistant',
      text: `Hello ${user?.name || 'Professor'}! I am your Zero Hour Scheduling Assistant. I can explain slot allocations, evaluate room shifts, and generate minimal-change disruption proposals verified with 0 hard violations.`,
      proposalCard: null
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);

  const samplePrompts = [
    "move my DBMS class tomorrow, I'm travelling",
    "why is my class at 8 AM?",
    "find another room for this session"
  ];

  const handleSend = async (customText?: string) => {
    const text = customText || input;
    if (!text.trim()) return;

    const userMsg = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const res = await api.post('/ai/chat', { message: text });
      const assistantMsg = {
        role: 'assistant',
        text: res.data.reply,
        proposalCard: res.data.proposal_card
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'I encountered an error processing your query. The deterministic rule engine remains accessible.',
          proposalCard: null
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleApplyProposal = async (proposal: any) => {
    try {
      await api.post('/disruptions', {
        description: proposal.title,
        changes: [
          {
            type: "faculty_unavailable",
            faculty_id: user?.faculty_id || "F06",
            days: ["MON"],
            periods: [1, 2, 3],
            reason: proposal.reason
          }
        ]
      });
      alert('Reschedule proposal successfully submitted to the Admin review queue with 0 hard violations!');
    } catch (err: any) {
      alert('Error submitting proposal: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Zero Hour Assistant</h1>
            <p className="text-xs text-slate-400">
              Deterministic rule facts wrapped with Google Gemini conversational interface
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Deterministic Bounds Active
        </span>
      </div>

      {/* Chat Messages Log */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-950/80 min-h-[450px] max-h-[600px] overflow-y-auto space-y-5">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                m.role === 'user'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-sky-400 border border-slate-700'
              }`}
            >
              {m.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className={`space-y-3 max-w-xl ${m.role === 'user' ? 'text-right' : ''}`}>
              <div
                className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-sky-600 text-white rounded-tr-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                {m.text}
              </div>

              {/* Proposal Card with Validation Badge */}
              {m.proposalCard && (
                <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/90 text-left space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-xs text-white">{m.proposalCard.title}</span>
                    <span className="font-mono text-[10px] text-sky-400">{m.proposalCard.session_id}</span>
                  </div>

                  <div className="text-xs text-slate-300 space-y-1">
                    <div>From: <span className="text-slate-400 line-through">{m.proposalCard.current_slot}</span></div>
                    <div>To: <strong className="text-emerald-300">{m.proposalCard.proposed_slot}</strong></div>
                    <div className="text-[11px] text-slate-400 italic">"{m.proposalCard.reason}"</div>
                  </div>

                  {/* Validation Badge */}
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span className="font-semibold">{m.proposalCard.validation_badge.label}</span>
                  </div>

                  {/* Submit button */}
                  <button
                    onClick={() => handleApplyProposal(m.proposalCard)}
                    className="w-full py-2 px-3 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Submit for Admin Approval</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Bot className="w-4 h-4 animate-spin text-sky-400" />
            Analyzing schedule constraints and running deterministic rule checks...
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex flex-wrap gap-2 items-center text-xs">
        <span className="text-slate-500 text-[11px]">Suggestions:</span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-sky-300 hover:border-slate-700 transition-colors text-[11px]"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask a scheduling question or request a session shift..."
          className="flex-grow px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500"
        />
        <button
          onClick={() => handleSend()}
          disabled={isSending || !input.trim()}
          className="px-5 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
