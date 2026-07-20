'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  Bot,
  Hand,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
  ArrowLeft,
  Search,
} from 'lucide-react';

const API_BASE = '/api';

type TaskStatus =
  | 'received'
  | 'processing'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'failed';

interface Task {
  id: number;
  employee_id: number;
  trigger_source: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string | null;
}

const STATUS_STYLES: Record<TaskStatus, { bg: string; text: string; border: string; label: string; icon: any }> = {
  received: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', label: 'Received', icon: Clock },
  processing: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Processing', icon: Bot },
  awaiting_approval: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Awaiting Approval', icon: Hand },
  approved: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', label: 'Approved', icon: CheckCircle2 },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Rejected', icon: XCircle },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Completed', icon: CheckCircle2 },
  failed: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', label: 'Failed', icon: AlertTriangle },
};

const ALL_STATUSES: TaskStatus[] = [
  'received',
  'processing',
  'awaiting_approval',
  'approved',
  'rejected',
  'completed',
  'failed',
];

function StatusBadge({ status }: { status: TaskStatus }) {
  const style = STATUS_STYLES[status];
  const Icon = style.icon;
  const isLive = status === 'processing' || status === 'received' || status === 'awaiting_approval';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
      {isLive && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
      )}
      {!isLive && <Icon className="w-3 h-3" />}
      {style.label}
    </span>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  async function fetchTasks() {
    const res = await fetch(`${API_BASE}/tasks`);
    if (res.ok) {
      const data = await res.json();
      setTasks(data);
    }
  }

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  const filteredTasks = tasks.filter((t) => {
    const matchesStatus = filter === 'all' || t.status === filter;
    const matchesSearch =
      search === '' ||
      t.id.toString().includes(search) ||
      t.status.toLowerCase().includes(search.toLowerCase()) ||
      t.trigger_source.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const statusCounts = ALL_STATUSES.reduce((acc, status) => {
    acc[status] = tasks.filter((t) => t.status === status).length;
    return acc;
  }, {} as Record<TaskStatus, number>);

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center text-primary hover:text-primary-hover text-sm font-medium transition">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to overview
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-semibold text-heading tracking-tight">All Tasks</h2>
        <span className="text-sm text-muted">{tasks.length} total</span>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search by ID, status, or trigger…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-page text-sm text-heading placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted shrink-0" />
            <button
              onClick={() => setFilter('all')}
              className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition ${
                filter === 'all'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-page text-body border-border hover:border-primary/30'
              }`}
            >
              All ({tasks.length})
            </button>
            {ALL_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition ${
                  filter === status
                    ? 'bg-primary text-white border-primary'
                    : 'bg-page text-body border-border hover:border-primary/30'
                }`}
              >
                {STATUS_STYLES[status].label} ({statusCounts[status]})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-page text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Trigger</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTasks.map((t) => (
                <tr key={t.id} className="hover:bg-page transition">
                  <td className="px-4 py-3 font-medium text-heading">#{t.id}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-body capitalize">{t.trigger_source}</td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="text-primary hover:text-primary-hover font-medium text-sm transition"
                    >
                      View trace →
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted">
                      <Search className="w-10 h-10" />
                      <p className="text-sm">No tasks match your filters.</p>
                      <button
                        onClick={() => { setFilter('all'); setSearch(''); }}
                        className="text-primary hover:text-primary-hover text-xs font-medium transition"
                      >
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
