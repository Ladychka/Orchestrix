'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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
  Loader2,
  ShieldCheck,
  Shield,
  Ban,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

const API_BASE = '/api'

interface Step {
  id: number
  step_number: number
  tool_called: string | null
  tool_input: any
  tool_output: any
  created_at: string
}

interface TaskDetail {
  id: number
  employee_id: number
  trigger_source: string
  status: string
  input_payload: Record<string, unknown>
  created_at: string
  updated_at: string | null
  steps: Step[]
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string
    icon: React.ElementType
    classes: string
  }
> = {
  received: {
    label: 'Received',
    icon: Clock,
    classes:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
  },
  processing: {
    label: 'Processing',
    icon: Bot,
    classes:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  },
  awaiting_approval: {
    label: 'Awaiting Approval',
    icon: Hand,
    classes:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  },
  approved: {
    label: 'Approved',
    icon: ShieldCheck,
    classes:
      'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800',
  },
  rejected: {
    label: 'Rejected',
    icon: Ban,
    classes:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  },
  failed: {
    label: 'Failed',
    icon: AlertTriangle,
    classes:
      'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.failed
  const Icon = config.icon
  const isLive =
    status === 'processing' || status === 'received' || status === 'awaiting_approval'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border',
        config.classes
      )}
    >
      {isLive && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {!isLive && <Icon className="w-4 h-4" />}
      {config.label}
    </span>
  )
}

// every tool gets a unique icon + color combo for the timeline
const TOOL_ICONS: Record<string, React.ElementType> = {
  check_inventory: Search,
  calculate_quote: Calculator,
  draft_quotation_email: Mail,
  request_approval: Hand,
  send_email: Send,
  reject_approval: XCircle,
}

const TOOL_COLORS: Record<string, string> = {
  check_inventory:
    'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  calculate_quote:
    'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  draft_quotation_email:
    'bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800',
  request_approval:
    'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  send_email:
    'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
  reject_approval:
    'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
}

function formatStepSummary(step: Step): string {
  const name = step.tool_called || 'Final response'
  const out = step.tool_output

  switch (name) {
    case 'check_inventory': {
      const results = Array.isArray(out)
        ? out
        : Array.isArray(out?.result)
          ? out.result
          : []
      if (results.length > 0) {
        const first = results[0] as Record<string, unknown>
        return `Found ${results.length} product(s) — e.g. "${first.name || first.sku || 'item'}"`
      }
      return 'No products found'
    }
    case 'calculate_quote': {
      const quote =
        (typeof out === 'object' && out !== null && !Array.isArray(out)
          ? out
          : out?.result) as Record<string, unknown> || {}
      const total = quote.total_price ?? quote.total ?? 'N/A'
      const items = Array.isArray(quote.line_items) ? quote.line_items.length : 0
      return items > 0
        ? `Calculated quote — ${items} line item(s), Total: $${total}`
        : 'Quote calculation result'
    }
    case 'draft_quotation_email': {
      const body =
        typeof out?.result === 'string'
          ? out.result
          : typeof out === 'string'
            ? out
            : ''
      const preview = body.split('\n').slice(0, 3).join(' ').substring(0, 80)
      return preview ? `Drafted email: "${preview}..."` : 'Drafted quotation email'
    }
    case 'request_approval': {
      return 'Paused for human approval via Telegram'
    }
    case 'send_email': {
      const sent = out?.sent === true
      return sent ? 'Email sent successfully' : 'Email failed to send'
    }
    case 'reject_approval': {
      return 'Rejected — flow stopped, no email sent'
    }
    default:
      return name
  }
}

function StepCard({ step, isLast }: { step: Step; isLast: boolean }) {
  const [showRaw, setShowRaw] = useState(false)
  const name = step.tool_called || 'response'
  const out = step.tool_output
  const hasError = out && (out.error || out?.result?.error)

  const Icon = TOOL_ICONS[name] || Bot
  const colorClass =
    TOOL_COLORS[name] ||
    'bg-muted text-muted-foreground border-border'

  return (
    <div className="relative pl-10 sm:pl-12">
      {/* vertical connector line between steps */}
      {!isLast && (
        <div className="absolute left-[19px] sm:left-[23px] top-10 bottom-0 w-px bg-border" />
      )}

      {/* step icon bubble */}
      <div
        className={cn(
          'absolute left-0 top-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center',
          colorClass
        )}
      >
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>

      <Card className="mb-6 hover:shadow-md transition-shadow">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Step {step.step_number}
              </span>
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded',
                  hasError
                    ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                )}
              >
                {name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRaw(!showRaw)}
              className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
            >
              {showRaw ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  Show details
                </>
              )}
            </Button>
          </div>

          <p className="text-sm font-medium mb-2">
            {formatStepSummary(step)}
          </p>

          {hasError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2 text-xs text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{String(out.error || out.result?.error || 'Unknown error')}</span>
              </div>
            </div>
          )}

          {showRaw && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-3">
              <div>
                <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wide font-semibold">
                  Input
                </p>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto border border-border max-h-40">
                  {JSON.stringify(step.tool_input, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs uppercase tracking-wide font-semibold">
                  Output
                </p>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto border border-border max-h-40">
                  {JSON.stringify(step.tool_output, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface StockWarning {
  sku: string
  requested: number
  in_stock: number
}

function extractStockWarnings(steps: Step[]): StockWarning[] {
  // find the most recent calculate_quote step and pull its stock_warnings
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]
    if (s.tool_called === 'calculate_quote' && s.tool_output) {
      const out = s.tool_output
      const warnings = out?.stock_warnings ?? out?.result?.stock_warnings ?? null
      if (Array.isArray(warnings)) {
        return warnings as StockWarning[]
      }
    }
  }
  return []
}

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const [task, setTask] = useState<TaskDetail | null>(null)

  async function fetchTask() {
    try {
      const res = await fetch(`${API_BASE}/tasks/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setTask(data)
      }
    } catch {
      // swallow errors so the UI doesn't flicker on transient network issues
    }
  }

  useEffect(() => {
    fetchTask()
    const interval = setInterval(fetchTask, 3000)
    return () => clearInterval(interval)
  }, [params.id])

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading task...</p>
      </div>
    )
  }

  const isFailed = task.status === 'failed'
  const hasSteps = task.steps.length > 0
  const noStepsAndFailed = isFailed && !hasSteps
  const isAwaitingApproval = task.status === 'awaiting_approval'
  const isCompleted = task.status === 'completed'
  const isRejected = task.status === 'rejected'
  const isTerminal = isCompleted || isRejected || isFailed
  const stockWarnings = extractStockWarnings(task.steps)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center text-sm font-medium text-primary hover:underline transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to tasks
      </Link>

      {/* Task Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-semibold tracking-tight">Task #{task.id}</h2>
            <StatusBadge status={task.status} />
          </div>

          {noStepsAndFailed && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 dark:bg-red-950 dark:border-red-800">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                    Task failed before any steps could run
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Common causes: Ollama not reachable, model not loaded, or Qdrant
                    connection error. Check the backend logs with{' '}
                    <code className="bg-red-100 dark:bg-red-900 px-1 rounded">
                      docker compose logs backend
                    </code>
                    .
                  </p>
                </div>
              </div>
            </div>
          )}

          {isAwaitingApproval && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 dark:bg-amber-950 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <Hand className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Waiting for human approval
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    The AI Finance Officer paused and sent a Telegram message with
                    Approve/Reject buttons. Tap one to continue the workflow.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4 dark:bg-emerald-950 dark:border-emerald-800">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    Workflow completed
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                    The quotation was approved and the email has been sent to the
                    customer.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 dark:bg-red-950 dark:border-red-800">
              <div className="flex items-start gap-3">
                <Ban className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                    Workflow rejected
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                    The human approver rejected this quotation. No email was sent.
                  </p>
                </div>
              </div>
            </div>
          )}

          {stockWarnings.length > 0 && (
            <Alert
              variant="destructive"
              className="mb-4 border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle>Stock warning</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  {stockWarnings.map((w) => (
                    <li key={w.sku}>
                      {w.sku} — requested {w.requested} units, only {w.in_stock} in stock.
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">
                From
              </span>
              <p className="font-medium mt-0.5">
                {String(task.input_payload?.from ?? '—')}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">
                Subject
              </span>
              <p className="font-medium mt-0.5">
                {String(task.input_payload?.subject ?? '—')}
              </p>
            </div>
            <div className="md:col-span-2">
              <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">
                Body
              </span>
              <p className="mt-0.5 bg-muted p-3 rounded-lg border border-border">
                {String(task.input_payload?.body ?? '—')}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">
                Created
              </span>
              <p className="mt-0.5">{new Date(task.created_at).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">
                Trigger
              </span>
              <p className="mt-0.5 capitalize">{task.trigger_source}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trace Section */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold tracking-tight">Step-by-step trace</h3>
            <div className="flex items-center gap-2">
              {hasSteps && (
                <Badge variant="secondary">
                  {task.steps.length} step{task.steps.length !== 1 ? 's' : ''}
                </Badge>
              )}
              {!isTerminal && (
                <Badge
                  variant="outline"
                  className="text-primary bg-primary/10 border-primary/20 animate-pulse"
                >
                  Live
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {!hasSteps && !isFailed && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">
                AI Finance Officer is working... steps will appear here shortly.
              </p>
            </div>
          )}

          {hasSteps && (
            <div className="space-y-0">
              {task.steps.map((step, idx) => (
                <StepCard
                  key={step.id}
                  step={step}
                  isLast={idx === task.steps.length - 1}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
