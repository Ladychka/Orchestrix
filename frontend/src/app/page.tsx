'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  ShieldCheck,
  Shield,
  Wrench,
  Database,
  Activity,
  Clock,
  Search,
  Calculator,
  Mail,
  Hand,
  Zap,
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

interface Employee {
  id: number;
  name: string;
  role: string;
  permissions: Record<string, any>;
  connected_tools: string[];
  knowledge_collection: string;
  created_at: string;
}

const STATUS_STYLES: Record<TaskStatus, { bg: string; text: string; border: string; label: string }> = {
  received: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', label: 'Received' },
  processing: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Processing' },
  awaiting_approval: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Awaiting Approval' },
  approved: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', label: 'Approved' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Rejected' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Completed' },
  failed: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', label: 'Failed' },
};

function StatusBadge({ status }: { status: TaskStatus }) {
  const style = STATUS_STYLES[status];
  const isLive = status === 'processing' || status === 'received' || status === 'awaiting_approval';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
      {isLive && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
        </span>
      )}
      {style.label}
    </span>
  );
}

const TOOL_ICONS: Record<string, any> = {
  check_inventory: Search,
  calculate_quote: Calculator,
  draft_quotation_email: Mail,
  request_approval: Hand,
};

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [empLoading, setEmpLoading] = useState(true);

  async function fetchTasks() {
    const res = await fetch(`${API_BASE}/tasks`);
    if (res.ok) {
      const data = await res.json();
      setTasks(data);
    }
  }

  async function fetchEmployee() {
    setEmpLoading(true);
    const res = await fetch(`${API_BASE}/employees`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setEmployee(data[0]);
      }
    }
    setEmpLoading(false);
  }

  useEffect(() => {
    fetchTasks();
    fetchEmployee();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  async function triggerDemo() {
    setLoading(true);
    await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from_email: 'customer@example.com',
        subject: 'Quote request',
        body: 'Please quote 200 units of SKU-101.',
        employee_id: 1,
      }),
    });
    await fetchTasks();
    setLoading(false);
  }

  const activeCount = tasks.filter(t => t.status === 'processing' || t.status === 'received').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const requiresApproval = employee?.permissions?.requires_approval === true;
  const canSendEmail = employee?.permissions?.can_send_email === true;

  return (
    <div className="space-y-8">
      {/* Employee Profile Card */}
      {empLoading ? (
        <div className="bg-card rounded-xl shadow-sm border border-border p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      ) : employee ? (
        <div className="bg-card rounded-xl shadow-sm border border-border p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Avatar / Icon */}
            <div className="shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-indigo-700 flex items-center justify-center text-white shadow-lg">
                <Bot className="w-8 h-8" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h2 className="text-2xl font-semibold text-heading tracking-tight">{employee.name}</h2>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {employee.role}
                </span>
                {activeCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-processing bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                    <Activity className="w-3 h-3" />
                    Working
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-completed bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    <Clock className="w-3 h-3" />
                    Idle
                  </span>
                )}
              </div>

              <p className="text-sm text-body mb-4">
                Autonomous AI employee handling quotation workflows with human-in-the-loop approval.
              </p>

              {/* Permissions & Tools */}
              <div className="flex flex-wrap gap-3 mb-5">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border ${
                    requiresApproval
                      ? 'bg-amber-50 text-status-awaiting_approval border-amber-200'
                      : 'bg-gray-50 text-body border-gray-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Requires approval: {requiresApproval ? 'Yes' : 'No'}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border ${
                    canSendEmail
                      ? 'bg-emerald-50 text-status-completed border-emerald-200'
                      : 'bg-gray-50 text-body border-gray-200'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Can send email: {canSendEmail ? 'Yes' : 'No'}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-50 text-body border border-gray-200">
                  <Database className="w-3.5 h-3.5" />
                  Knowledge: {employee.knowledge_collection}
                </span>
              </div>

              {/* Connected Tools */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted font-medium mr-1">Connected tools:</span>
                {employee.connected_tools.map((tool) => {
                  const Icon = TOOL_ICONS[tool] || Wrench;
                  return (
                    <span
                      key={tool}
                      className="inline-flex items-center gap-1 text-xs bg-gray-50 text-body px-2 py-1 rounded-md border border-gray-100"
                    >
                      <Icon className="w-3 h-3" />
                      {tool}
                    </span>
                  );
                })}
              </div>

              {/* Stats */}
              <div className="flex gap-6 mt-5 pt-4 border-t border-border">
                <div>
                  <p className="text-2xl font-semibold text-heading">{tasks.length}</p>
                  <p className="text-xs text-muted">Total tasks</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-heading">{completedCount}</p>
                  <p className="text-xs text-muted">Completed</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-heading">{activeCount}</p>
                  <p className="text-xs text-muted">Active</p>
                </div>
              </div>
            </div>

            {/* Trigger Button */}
            <div className="shrink-0 md:self-center">
              <button
                onClick={triggerDemo}
                disabled={loading}
                className="bg-primary hover:bg-primary-hover text-white font-semibold px-6 py-3 rounded-xl shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                {loading ? 'Triggering…' : 'Trigger Demo Task'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tasks Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-heading tracking-tight">Recent Tasks</h3>
          <Link
            href="/tasks"
            className="text-sm font-medium text-primary hover:text-primary-hover transition"
          >
            View all →
          </Link>
        </div>

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
                {tasks.slice(0, 10).map((t) => (
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
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted">
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
        </div>
      </div>
    </div>
  );
}
