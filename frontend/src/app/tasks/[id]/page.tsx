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
    return <div className="p-6">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <Link href="/" className="text-blue-600 hover:underline text-sm">
        ← Back to tasks
      </Link>

      <div className="bg-white rounded shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Task #{task.id}</h2>
          <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100">
            {task.status}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          <strong>From:</strong> {String(task.input_payload?.from ?? '—')}
        </p>
        <p className="text-sm text-gray-600 mb-2">
          <strong>Subject:</strong> {String(task.input_payload?.subject ?? '—')}
        </p>
        <p className="text-sm text-gray-600">
          <strong>Body:</strong> {String(task.input_payload?.body ?? '—')}
        </p>
      </div>

      <div className="bg-white rounded shadow p-6">
        <h3 className="text-md font-semibold mb-4">Step-by-step trace</h3>
        {task.steps.length === 0 && (
          <p className="text-sm text-gray-500">No steps recorded yet.</p>
        )}
        <div className="space-y-4">
          {task.steps.map((step) => (
            <div
              key={step.id}
              className="border rounded p-4 hover:bg-gray-50 transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-gray-500">
                  Step {step.step_number}
                </span>
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {step.tool_called ?? 'response'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Input</p>
                  <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                    {JSON.stringify(step.tool_input, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Output</p>
                  <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                    {JSON.stringify(step.tool_output, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
