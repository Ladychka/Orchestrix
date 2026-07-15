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

const STATUS_COLORS: Record<TaskStatus, string> = {
  received: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  awaiting_approval: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-gray-200 text-gray-800',
};

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <button
          onClick={triggerDemo}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Triggering…' : 'Trigger Demo Task'}
        </button>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Trigger</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{t.id}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[t.status]}`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3">{t.trigger_source}</td>
                <td className="px-4 py-3">
                  {new Date(t.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/tasks/${t.id}`} className="text-blue-600 hover:underline">
                    View trace
                  </Link>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  No tasks yet. Click "Trigger Demo Task" to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
