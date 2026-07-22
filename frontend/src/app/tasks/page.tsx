'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Search,
  ListFilter,
  Clock,
  Bot,
  Hand,
  ShieldCheck,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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
    icon: XCircle,
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

const ALL_STATUSES: TaskStatus[] = [
  'received',
  'processing',
  'awaiting_approval',
  'approved',
  'rejected',
  'completed',
  'failed',
]

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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  async function fetchTasks() {
    try {
      const res = await fetch(`${API_BASE}/tasks`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch {
      // network hiccups are fine, we'll retry in 3s
    }
  }

  useEffect(() => {
    fetchTasks()
    const interval = setInterval(fetchTasks, 3000)
    return () => clearInterval(interval)
  }, [])

  const filteredTasks = tasks.filter((t) => {
    const matchesStatus = filter === 'all' || t.status === filter
    const matchesSearch =
      search === '' ||
      t.id.toString().includes(search) ||
      t.status.toLowerCase().includes(search.toLowerCase()) ||
      t.trigger_source.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // build counts for each status so filter chips show real numbers
  const statusCounts = ALL_STATUSES.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status).length
      return acc
    },
    {} as Record<TaskStatus, number>
  )

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center text-sm font-medium text-primary hover:underline transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to overview
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">All Tasks</h2>
        <span className="text-sm text-muted-foreground">{tasks.length} total</span>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by ID, status, or trigger..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ListFilter className="w-4 h-4 text-muted-foreground shrink-0" />
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
                className="text-xs h-8"
              >
                All ({tasks.length})
              </Button>
              {ALL_STATUSES.map((status) => (
                <Button
                  key={status}
                  variant={filter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(status)}
                  className="text-xs h-8"
                >
                  {STATUS_CONFIG[status].label} ({statusCounts[status]})
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  ID
                </th>
                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Trigger
                </th>
                <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Created
                </th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTasks.map((t) => (
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
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Search className="w-10 h-10" />
                      <p className="text-sm">No tasks match your filters.</p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setFilter('all')
                          setSearch('')
                        }}
                        className="text-xs font-medium"
                      >
                        Clear filters
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
