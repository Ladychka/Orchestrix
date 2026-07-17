'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = '/api';

interface Step {
  id: number;
  step_number: number;
  tool_called: string | null;
  tool_input: Record<string, unknown>;
  tool_output: Record<string, unknown>;
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

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  received: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Received' },
  processing: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Processing' },
  awaiting_approval: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Awaiting Approval' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Completed' },
  failed: { bg: 'bg-gray-200', text: 'text-gray-800', label: 'Failed' },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.failed;
  const isLive = status === 'processing' || status === 'received';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
      {isLive && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
        </span>
      )}
      {style.label}
    </span>
  );
}

function formatStepSummary(step: Step): string {
  const name = step.tool_called || 'Final response';
  const out = step.tool_output || {};

  switch (name) {
    case 'check_inventory': {
      const results = Array.isArray(out.result) ? out.result : [];
      if (results.length > 0) {
        const first = results[0] as Record<string, unknown>;
        return `Found ${results.length} product(s) — e.g. "${first.name || first.sku || 'item'}"`;
      }
      return 'No products found';
    }
    case 'calculate_quote': {
      const quote = (out.result as Record<string, unknown>) || {};
      const total = quote.total_price;
      const items = Array.isArray(quote.line_items) ? quote.line_items.length : 0;
      return items > 0 ? `Calculated quote — ${items} line item(s), Total: $${total}` : 'Quote calculation error';
    }
    case 'draft_quotation_email': {
      const body = typeof out.result === 'string' ? out.result : '';
      const preview = body.split('\n').slice(0, 3).join(' ').substring(0, 80);
      return preview ? `Drafted email: "${preview}..."` : 'Drafted quotation email';
    }
    case 'request_approval': {
      const status = (out.status as string) || 'awaiting_approval';
      return `⏸️ Paused for human approval — ${status}`;
    }
    case 'send_email': {
      const sent = out.sent === true;
      return sent ? '✅ Email sent successfully' : '❌ Email failed to send';
    }
    default:
      return name;
  }
}

function StepCard({ step }: { step: Step }) {
  const [showRaw, setShowRaw] = useState(false);
  const name = step.tool_called || 'response';
  const out = step.tool_output as Record<string, any>;
  const hasError = out && (out.error || out.result?.error);

  const toolColors: Record<string, string> = {
    check_inventory: 'border-l-blue-500',
    calculate_quote: 'border-l-green-500',
    draft_quotation_email: 'border-l-purple-500',
    request_approval: 'border-l-orange-500',
    send_email: 'border-l-emerald-500',
    reject_approval: 'border-l-red-500',
  };

  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${toolColors[name] || 'border-l-gray-400'} rounded-lg shadow-sm hover:shadow-md transition`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              Step {step.step_number}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${hasError ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
              {name}
            </span>
          </div>
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs text-gray-500 hover:text-gray-800 underline"
          >
            {showRaw ? 'Hide details' : 'Show details'}
          </button>
        </div>

        <p className="text-sm text-gray-800 font-medium mb-2">
          {formatStepSummary(step)}
        </p>

        {hasError && (
          <div className="bg-red-50 border border-red-200 rounded p-2 mb-2 text-xs text-red-700">
            <strong>Error:</strong> {String(out.error || out.result?.error || 'Unknown error')}
          </div>
        )}

        {showRaw && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-2">
            <div>
              <p className="text-gray-500 mb-1 text-xs uppercase tracking-wide font-medium">Input</p>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto border border-gray-100 max-h-40">
                {JSON.stringify(step.tool_input, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-gray-500 mb-1 text-xs uppercase tracking-wide font-medium">Output</p>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto border border-gray-100 max-h-40">
                {JSON.stringify(step.tool_output, null, 2)}
              </pre>
            </div>
          </div>
        )}
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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 text-sm">Loading task…</p>
      </div>
    );
  }

  const isFailed = task.status === 'failed';
  const hasSteps = task.steps.length > 0;
  const noStepsAndFailed = isFailed && !hasSteps;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium transition">
        ← Back to tasks
      </Link>

      {/* Task Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-xl font-bold text-gray-900">Task #{task.id}</h2>
          <StatusBadge status={task.status} />
        </div>

        {noStepsAndFailed && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-red-500 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-red-800">Task failed before any steps could run</p>
                <p className="text-xs text-red-600 mt-1">
                  Common causes: missing Gemini API key, API quota exhausted, or Qdrant connection error.
                  Check the backend logs with <code className="bg-red-100 px-1 rounded">docker compose logs backend</code>.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 font-medium">From</span>
            <p className="text-gray-900 font-medium mt-0.5">{String(task.input_payload?.from ?? '—')}</p>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Subject</span>
            <p className="text-gray-900 font-medium mt-0.5">{String(task.input_payload?.subject ?? '—')}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-500 font-medium">Body</span>
            <p className="text-gray-900 mt-0.5 bg-gray-50 p-3 rounded border border-gray-100">
              {String(task.input_payload?.body ?? '—')}
            </p>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Created</span>
            <p className="text-gray-900 mt-0.5">{new Date(task.created_at).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-gray-500 font-medium">Trigger</span>
            <p className="text-gray-900 mt-0.5 capitalize">{task.trigger_source}</p>
          </div>
        </div>
      </div>

      {/* Trace Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Step-by-step trace</h3>
          {hasSteps && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {task.steps.length} step{task.steps.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {!hasSteps && !isFailed && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm">AI Finance Officer is working… steps will appear here shortly.</p>
          </div>
        )}

        {hasSteps && (
          <div className="space-y-4">
            {task.steps.map((step) => (
              <StepCard key={step.id} step={step} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
