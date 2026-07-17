'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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

const STATUS_STYLES: Record<TaskStatus, { bg: string; text: string; label: string }> = {
  received: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Received' },
  processing: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Processing' },
  awaiting_approval: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Awaiting Approval' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Completed' },
  failed: { bg: 'bg-gray-200', text: 'text-gray-800', label: 'Failed' },
};

function StatusBadge({ status }: { status: TaskStatus }) {
  const style = STATUS_STYLES[status];
  const isLive = status === 'processing' || status === 'received';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
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

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">Tasks</h2>
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
              </span>
              {activeCount} active
            </span>
          )}
        </div>
        <button
          onClick={triggerDemo}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Triggering…' : 'Trigger Demo Task'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Trigger</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">#{t.id}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{t.trigger_source}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm transition"
                    >
                      View trace →
                    </Link>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                      <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-sm">No tasks yet.</p>
                      <p className="text-xs">Click "Trigger Demo Task" to start your first quotation workflow.</p>
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
