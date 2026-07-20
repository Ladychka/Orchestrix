'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Calculator,
  Mail,
  Hand,
  Send,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Bot,
  ArrowLeft,
} from 'lucide-react';

const API_BASE = '/api';

interface Step {
  id: number;
  step_number: number;
  tool_called: string | null;
  tool_input: any;
  tool_output: any;
  created_at: string;
}

interface TaskDetail {
  id: number;
  employee_id: number;
  trigger_source: string;
  status: string;
  input_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string | null;
  steps: Step[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string; icon: any }> = {
  received: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', label: 'Received', icon: Clock },
  processing: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Processing', icon: Bot },
  awaiting_approval: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Awaiting Approval', icon: Hand },
  approved: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', label: 'Approved', icon: CheckCircle2 },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Rejected', icon: XCircle },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Completed', icon: CheckCircle2 },
  failed: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', label: 'Failed', icon: AlertTriangle },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.failed;
  const Icon = style.icon;
  const isLive = status === 'processing' || status === 'received' || status === 'awaiting_approval';
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border ${style.bg} ${style.text} ${style.border}`}>
      {isLive && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
      )}
      {!isLive && <Icon className="w-4 h-4" />}
      {style.label}
    </span>
  );
}

const TOOL_ICONS: Record<string, any> = {
  check_inventory: Search,
  calculate_quote: Calculator,
  draft_quotation_email: Mail,
  request_approval: Hand,
  send_email: Send,
  reject_approval: XCircle,
};

const TOOL_COLORS: Record<string, string> = {
  check_inventory: 'bg-blue-50 text-blue-600 border-blue-200',
  calculate_quote: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  draft_quotation_email: 'bg-violet-50 text-violet-600 border-violet-200',
  request_approval: 'bg-amber-50 text-amber-600 border-amber-200',
  send_email: 'bg-sky-50 text-sky-600 border-sky-200',
  reject_approval: 'bg-red-50 text-red-600 border-red-200',
};

function formatStepSummary(step: Step): string {
  const name = step.tool_called || 'Final response';
  const out = step.tool_output;

  switch (name) {
    case 'check_inventory': {
      const results = Array.isArray(out) ? out : Array.isArray(out?.result) ? out.result : [];
      if (results.length > 0) {
        const first = results[0] as Record<string, unknown>;
        return `Found ${results.length} product(s) — e.g. "${first.name || first.sku || 'item'}"`;
      }
      return 'No products found';
    }
    case 'calculate_quote': {
      const quote = (typeof out === 'object' && out !== null && !Array.isArray(out) ? out : out?.result) as Record<string, unknown> || {};
      const total = quote.total_price ?? quote.total ?? 'N/A';
      const items = Array.isArray(quote.line_items) ? quote.line_items.length : 0;
      return items > 0 ? `Calculated quote — ${items} line item(s), Total: $${total}` : 'Quote calculation result';
    }
    case 'draft_quotation_email': {
      const body = typeof out?.result === 'string' ? out.result : typeof out === 'string' ? out : '';
      const preview = body.split('\n').slice(0, 3).join(' ').substring(0, 80);
      return preview ? `Drafted email: "${preview}..."` : 'Drafted quotation email';
    }
    case 'request_approval': {
      return '⏸️ Paused for human approval via Telegram';
    }
    case 'send_email': {
      const sent = out?.sent === true;
      return sent ? '✅ Email sent successfully' : '❌ Email failed to send';
    }
    case 'reject_approval': {
      return '❌ Rejected — flow stopped, no email sent';
    }
    default:
      return name;
  }
}

function StepCard({ step, isLast }: { step: Step; isLast: boolean }) {
  const [showRaw, setShowRaw] = useState(false);
  const name = step.tool_called || 'response';
  const out = step.tool_output;
  const hasError = out && (out.error || out?.result?.error);

  const Icon = TOOL_ICONS[name] || Bot;
  const colorClass = TOOL_COLORS[name] || 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <div className="relative pl-10 sm:pl-12">
      {!isLast && (
        <div className="absolute left-[19px] sm:left-[23px] top-10 bottom-0 w-px bg-border" />
      )}

      <div className={`absolute left-0 top-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center ${colorClass}`}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border hover:shadow-md transition mb-6">
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted bg-page px-2 py-0.5 rounded">
                Step {step.step_number}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${hasError ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                {name}
              </span>
            </div>
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="text-xs text-muted hover:text-heading flex items-center gap-1 transition"
            >
              {showRaw ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> Show details
                </>
              )}
            </button>
          </div>

          <p className="text-sm text-heading font-medium mb-2">
            {formatStepSummary(step)}
          </p>

          {hasError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2 text-xs text-red-700">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{String(out.error || out.result?.error || 'Unknown error')}</span>
              </div>
            </div>
          )}

          {showRaw && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-3">
              <div>
                <p className="text-muted mb-1 text-xs uppercase tracking-wide font-semibold">Input</p>
                <pre className="bg-page p-3 rounded-lg text-xs overflow-auto border border-border max-h-40">
                  {JSON.stringify(step.tool_input, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-muted mb-1 text-xs uppercase tracking-wide font-semibold">Output</p>
                <pre className="bg-page p-3 rounded-lg text-xs overflow-auto border border-border max-h-40">
                  {JSON.stringify(step.tool_output, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const [task, setTask] = useState<TaskDetail | null>(null);

  async function fetchTask() {
    const res = await fetch(`${API_BASE}/tasks/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setTask(data);
    }
  }

  useEffect(() => {
    fetchTask();
    const interval = setInterval(fetchTask, 3000);
    return () => clearInterval(interval);
  }, [params.id]);

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <p className="text-body text-sm">Loading task…</p>
      </div>
    );
  }

  const isFailed = task.status === 'failed';
  const hasSteps = task.steps.length > 0;
  const noStepsAndFailed = isFailed && !hasSteps;
  const isAwaitingApproval = task.status === 'awaiting_approval';
  const isCompleted = task.status === 'completed';
  const isRejected = task.status === 'rejected';
  const isTerminal = isCompleted || isRejected || isFailed;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link href="/" className="inline-flex items-center text-primary hover:text-primary-hover text-sm font-medium transition">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to tasks
      </Link>

      {/* Task Info Card */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-xl font-semibold text-heading tracking-tight">Task #{task.id}</h2>
          <StatusBadge status={task.status} />
        </div>

        {noStepsAndFailed && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">Task failed before any steps could run</p>
                <p className="text-xs text-red-600 mt-1">
                  Common causes: Ollama not reachable, model not loaded, or Qdrant connection error.
                  Check the backend logs with <code className="bg-red-100 px-1 rounded">docker compose logs backend</code>.
                </p>
              </div>
            </div>
          </div>
        )}

        {isAwaitingApproval && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <Hand className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Waiting for human approval</p>
                <p className="text-xs text-amber-700 mt-1">
                  The AI Finance Officer paused and sent a Telegram message with Approve/Reject buttons.
                  Tap one to continue the workflow.
                </p>
              </div>
            </div>
          </div>
        )}

        {isCompleted && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Workflow completed</p>
                <p className="text-xs text-emerald-700 mt-1">
                  The quotation was approved and the email has been sent to the customer.
                </p>
              </div>
            </div>
          </div>
        )}

        {isRejected && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">Workflow rejected</p>
                <p className="text-xs text-red-700 mt-1">
                  The human approver rejected this quotation. No email was sent.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted font-medium text-xs uppercase tracking-wide">From</span>
            <p className="text-heading font-medium mt-0.5">{String(task.input_payload?.from ?? '—')}</p>
          </div>
          <div>
            <span className="text-muted font-medium text-xs uppercase tracking-wide">Subject</span>
            <p className="text-heading font-medium mt-0.5">{String(task.input_payload?.subject ?? '—')}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-muted font-medium text-xs uppercase tracking-wide">Body</span>
            <p className="text-heading mt-0.5 bg-page p-3 rounded-lg border border-border">
              {String(task.input_payload?.body ?? '—')}
            </p>
          </div>
          <div>
            <span className="text-muted font-medium text-xs uppercase tracking-wide">Created</span>
            <p className="text-heading mt-0.5">{new Date(task.created_at).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-muted font-medium text-xs uppercase tracking-wide">Trigger</span>
            <p className="text-heading mt-0.5 capitalize">{task.trigger_source}</p>
          </div>
        </div>
      </div>

      {/* Trace Section */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-heading tracking-tight">Step-by-step trace</h3>
          <div className="flex items-center gap-2">
            {hasSteps && (
              <span className="text-xs text-muted bg-page px-2.5 py-1 rounded-full">
                {task.steps.length} step{task.steps.length !== 1 ? 's' : ''}
              </span>
            )}
            {!isTerminal && (
              <span className="text-xs text-primary bg-primary/10 px-2.5 py-1 rounded-full animate-pulse">
                Live
              </span>
            )}
          </div>
        </div>

        {!hasSteps && !isFailed && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-sm">AI Finance Officer is working… steps will appear here shortly.</p>
          </div>
        )}

        {hasSteps && (
          <div className="space-y-0">
            {task.steps.map((step, idx) => (
              <StepCard key={step.id} step={step} isLast={idx === task.steps.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
