import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../lib/authContext';
import { useToast } from '../components/Toast';
import { usePageMetadata } from '../lib/usePageMetadata';
import { 
  Send, ShieldCheck, 
  CheckCircle2, ArrowRight, User as UserIcon, Bot
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';

export const AssistantPage: React.FC = () => {
  usePageMetadata(
    'AI Faculty Timetable Assistant | CIT Campus Portal',
    'Natural language timetable scheduler assistant powered by Google Gemini and deterministic constraint validation for faculty slot explanations.'
  );

  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'assistant',
      text: `Hello ${user?.name || 'Professor'}! I am your CIT Faculty Scheduling Assistant. I can explain slot allocations, evaluate room shifts, and generate minimal-change disruption proposals verified with 0 hard violations.`,
      proposalCard: null
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isFallbackMode, setIsFallbackMode] = useState<boolean>(false);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([
    "move my DBMS class tomorrow, I'm travelling",
    "mera DBMS ka class kal shift kar do, bahar jaana hai",
    "why is my class at 8 AM?",
    "find another room for Tuesday period 3"
  ]);

  const handleSend = async (customText?: string) => {
    const text = customText || input;
    if (!text.trim()) return;

    const userMsg = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const res = await api.post('/ai/chat', { message: text });
      if (res.data.is_fallback) {
        setIsFallbackMode(true);
      }
      if (res.data.suggested_actions && res.data.suggested_actions.length > 0) {
        setSuggestedActions(res.data.suggested_actions);
      }

      const assistantMsg = {
        role: 'assistant',
        text: res.data.reply,
        proposalCard: res.data.proposal_card
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: err.response?.data?.detail || 'I encountered an error processing your query. The deterministic rule engine remains accessible.',
          proposalCard: null
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleApplyProposal = async (proposal: any) => {
    if (!user?.faculty_id && user?.role === 'faculty') {
      showToast('Faculty ID is not configured on your user profile.', 'error');
      return;
    }

    try {
      const changes = proposal.action_payload?.changes || [
        {
          type: "faculty_unavailable",
          faculty_id: user?.faculty_id,
          session_id: proposal.session_id,
          days: proposal.days || (proposal.current_slot_parsed ? [proposal.current_slot_parsed.day] : ["MON"]),
          periods: proposal.periods || (proposal.current_slot_parsed ? [proposal.current_slot_parsed.period] : [1]),
          reason: proposal.reason
        }
      ];

      await api.post('/disruptions', {
        description: proposal.title || `Reschedule Request: ${proposal.session_id}`,
        changes
      });
      showToast('Reschedule proposal successfully submitted to the Admin review queue with 0 hard violations!', 'success');
    } catch (err: any) {
      showToast('Error submitting proposal: ' + (err.response?.data?.detail || err.message), 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        title="CIT Scheduling Assistant"
        subtitle="Deterministic constraint facts wrapped in Google Gemini conversational interface for schedule queries and move simulations."
        badge={
          isFallbackMode ? (
            <StatusBadge status="warning" size="sm" label="Rule-based mode" />
          ) : (
            <StatusBadge status="success" size="sm" label="Gemini + Rules Active" icon={<ShieldCheck className="w-3.5 h-3.5" />} />
          )
        }
      />

      {/* Chat Messages Log */}
      <Panel variant="default" padded={false} className="p-5 sm:p-6 min-h-[460px] max-h-[600px] overflow-y-auto space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 text-xs font-bold ${
                m.role === 'user'
                  ? 'bg-[#142D50] text-[#F1F5F9]'
                  : 'bg-[#F5F7FB] text-[#2563EB] border border-[#E2E8F0]'
              }`}
            >
              {m.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className={`space-y-3 max-w-xl ${m.role === 'user' ? 'text-right' : ''}`}>
              <div
                className={`p-3.5 rounded-[10px] text-xs sm:text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#142D50] text-[#F1F5F9] rounded-tr-none text-left'
                    : 'bg-[#FFFFFF] border border-[#E2E8F0] text-[#172B4D] rounded-tl-none shadow-xs text-left'
                }`}
              >
                {m.text}
              </div>

              {/* Proposal Card with Validation Badge */}
              {m.proposalCard && (
                <Panel variant="raised" className="p-4 text-left space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                    <span className="font-sans font-bold text-xs text-[#172B4D]">{m.proposalCard.title}</span>
                    <span className="font-mono text-[10px] text-[#2563EB]">{m.proposalCard.session_id}</span>
                  </div>

                  <div className="text-xs text-[#475569] space-y-1">
                    <div>From: <span className="text-[#64748B] line-through">{m.proposalCard.current_slot}</span></div>
                    <div>To: <strong className="text-[#2F7D4F]">{m.proposalCard.proposed_slot}</strong></div>
                    <div className="text-[11px] text-[#64748B] italic">"{m.proposalCard.reason}"</div>
                  </div>

                  {/* Minimal-change alternatives */}
                  {m.proposalCard.alternatives && m.proposalCard.alternatives.length > 0 && (
                    <div className="pt-2 border-t border-[#E2E8F0] text-[11px] space-y-1.5">
                      <div className="text-[#475569] font-semibold uppercase tracking-wider text-[10px]">
                        Solver-Verified Alternatives:
                      </div>
                      {m.proposalCard.alternatives.map((alt: any, aIdx: number) => (
                        <div key={aIdx} className="bg-[#F5F7FB] p-2 rounded-[6px] border border-[#E2E8F0] text-[#172B4D] flex items-center justify-between">
                          <span>{alt.label || `${alt.day} P${alt.start_period} in ${alt.room_name}`}</span>
                          <span className="font-mono text-[10px] text-[#2F7D4F] bg-[#EBF5EE] px-1.5 py-0.5 rounded border border-[#C3E2CD]">0 Clashes</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Validation Badge & Soft Breakdown */}
                  <div className="p-2.5 rounded-[8px] bg-[#EBF5EE] border border-[#C3E2CD] text-[#2F7D4F] text-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="font-semibold">{m.proposalCard.validation_badge.label}</span>
                    </div>
                    {m.proposalCard.validation_badge.soft_breakdown && (
                      <div className="flex flex-wrap gap-1 text-[9px] font-mono pt-1 border-t border-[#C3E2CD] text-[#2F7D4F]">
                        {Object.entries(m.proposalCard.validation_badge.soft_breakdown).map(([k, v]: [string, any]) => (
                          <span key={k} className="px-1.5 py-0.2 rounded bg-[#FFFFFF] border border-[#C3E2CD]">
                            {k}: {v >= 0 ? `+${v}` : v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Submit button */}
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => handleApplyProposal(m.proposalCard)}
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                    iconPosition="right"
                  >
                    Submit for Admin Approval
                  </Button>
                </Panel>
              )}
            </div>
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-[#475569] font-mono">
            <Bot className="w-4 h-4 animate-spin text-[#2563EB]" />
            Analyzing schedule constraints and running deterministic rule checks...
          </div>
        )}
      </Panel>

      {/* Suggested Prompt Chips */}
      <div className="flex flex-wrap gap-1.5 items-center text-xs">
        <span className="text-[#64748B] text-[11px] font-mono">Suggestions:</span>
        {suggestedActions.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(p)}
            className="px-3 py-1 rounded-full bg-[#FFFFFF] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#475569] hover:text-[#172B4D] transition-colors text-[11px] cursor-pointer"
          >
            "{p}"
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
          placeholder="Ask a scheduling question or request a class move..."
          className="flex-grow px-4 py-2.5 rounded-[8px] bg-[#FFFFFF] border border-[#E2E8F0] text-[#172B4D] placeholder-[#64748B]/60 text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
        />
        <Button
          variant="primary"
          size="md"
          onClick={() => handleSend()}
          disabled={isSending || !input.trim()}
          icon={<Send className="w-4 h-4" />}
        >
          Send
        </Button>
      </div>
    </div>
  );
};
