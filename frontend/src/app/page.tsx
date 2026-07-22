'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Bot,
  ShieldCheck,
  Shield,
  Database,
  Activity,
  Clock,
  Search,
  Calculator,
  Mail,
  Hand,
  Zap,
  ArrowRight,
  Loader2,
  Wrench,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

const API_BASE = '/api'

type TaskStatus =
  | 'received'
  | 'processing'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed'

interface Task {
  id: number
  employee_id: number
  trigger_source: string
  status: TaskStatus
  created_at: string
  updated_at: string | null
}

interface Employee {
  id: number
  name: string
  role: string
  permissions: Record<string, any>
  connected_tools: string[]
  knowledge_collection: string
  created_at: string
}

// maps each status to colors + lucide icon
const STATUS_CONFIG: Record<
  TaskStatus,
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
    icon: Loader2,
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
    icon: Shield,
    classes:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  },
  completed: {
    label: 'Completed',
    icon: ShieldCheck,
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  },
  failed: {
    label: 'Failed',
    icon: Shield,
    classes:
      'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  },
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  const isLive =
    status === 'processing' || status === 'received' || status === 'awaiting_approval'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
        config.classes
      )}
    >
      {isLive && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {!isLive && <Icon className="w-3 h-3" />}
      {config.label}
    </span>
  )
}

// tiny mapping so each tool gets its own icon
const TOOL_ICONS: Record<string, React.ElementType> = {
  check_inventory: Search,
  calculate_quote: Calculator,
  draft_quotation_email: Mail,
  request_approval: Hand,
}

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(false)
  const [empLoading, setEmpLoading] = useState(true)

  // poll tasks every few seconds so the dashboard feels alive
  async function fetchTasks() {
    try {
      const res = await fetch(`${API_BASE}/tasks`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch {
      // silently fail so the UI doesn't flicker on transient network hiccups
    }
  }

  async function fetchEmployee() {
    setEmpLoading(true)
    try {
      const res = await fetch(`${API_BASE}/employees`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setEmployee(data[0])
        }
      }
    } finally {
      setEmpLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
    fetchEmployee()
    const interval = setInterval(fetchTasks, 3000)
    return () => clearInterval(interval)
  }, [])

  async function triggerDemo() {
    setLoading(true)
    try {
      await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_email: 'customer@example.com',
          subject: 'Quote request',
          body: 'Please quote 200 units of SKU-101.',
          employee_id: 1,
        }),
      })
    } finally {
      await fetchTasks()
      setLoading(false)
    }
  }

  const activeCount = tasks.filter(
    (t) => t.status === 'processing' || t.status === 'received'
  ).length
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const requiresApproval = employee?.permissions?.requires_approval === true
  const canSendEmail = employee?.permissions?.can_send_email === true

  return (
    <div className="space-y-8">
      {/* Employee Profile Card */}
      {empLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ) : employee ? (
        <Card className="overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              {/* Avatar */}
              <div className="shrink-0">
                <div
                  className={cn(
                    'w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-indigo-600',
                    'flex items-center justify-center text-primary-foreground shadow-lg',
                    'transition-transform hover:scale-105'
                  )}
                >
                  <Bot className="w-8 h-8" />
                </div>
              </div>

              {/* Info block */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {employee.name}
                  </h2>
                  <Badge variant="secondary">{employee.role}</Badge>
                  {activeCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                    >
                      <Activity className="w-3 h-3 mr-1" />
                      Working
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      Idle
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  Autonomous AI employee handling quotation workflows with
                  human-in-the-loop approval.
                </p>

                {/* Permissions row */}
                <div className="flex flex-wrap gap-3 mb-5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border',
                      requiresApproval
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                        : 'bg-muted text-muted-foreground border-border'
                    )}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Requires approval: {requiresApproval ? 'Yes' : 'No'}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border',
                      canSendEmail
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-muted text-muted-foreground border-border'
                    )}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Can send email: {canSendEmail ? 'Yes' : 'No'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-muted text-muted-foreground border-border">
                    <Database className="w-3.5 h-3.5" />
                    Knowledge: {employee.knowledge_collection}
                  </span>
                </div>

                {/* Connected tools */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground font-medium mr-1">
                    Connected tools:
                  </span>
                  {employee.connected_tools.map((tool) => {
                    const Icon = TOOL_ICONS[tool] || Wrench
                    return (
                      <span
                        key={tool}
                        className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors"
                      >
                        <Icon className="w-3 h-3" />
                        {tool}
                      </span>
                    )
                  })}
                </div>

                {/* Stats */}
                <Separator className="my-5" />
                <div className="flex gap-8">
                  <div>
                    <p className="text-2xl font-semibold">{tasks.length}</p>
                    <p className="text-xs text-muted-foreground">Total tasks</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{completedCount}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">{activeCount}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                </div>
              </div>

              {/* Trigger button */}
              <div className="shrink-0 md:self-center">
                <Button
                  onClick={triggerDemo}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {loading ? 'Triggering...' : 'Trigger Demo Task'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Recent Tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold tracking-tight">Recent Tasks</h3>
          <Link
            href="/tasks"
            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">Trigger</th>
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">Created</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.slice(0, 10).map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-muted/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">#{t.id}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {t.trigger_source}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="text-primary hover:underline font-medium text-sm"
                      >
                        View trace
                      </Link>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Clock className="w-10 h-10" />
                        <p className="text-sm">No tasks yet.</p>
                        <p className="text-xs">
                          Click "Trigger Demo Task" to start your first quotation workflow.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
