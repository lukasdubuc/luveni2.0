import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Adjust import based on configuration

interface Agent {
  id: string;
  name: string;
  business: string;
  status: 'idle' | 'working' | 'error';
  last_task: string;
  last_run: string;
  error_message: string | null;
}

const DEPARTMENT_MAP: Record<string, { title: string; subtitle: string }> = {
  'creative-scout': { title: 'Creative Scout', subtitle: 'Research Lab / Art Design' },
  'margin-guard': { title: 'Margin Guard', subtitle: 'Treasury / Dynamic Pricing' },
  'affiliate-outreacher': { title: 'Affiliate Outreacher', subtitle: 'Sales Lab / Creator UGC' },
  'legality-auditor': { title: 'Legality Auditor', subtitle: 'Compliance / IP Verification' },
  'customer-outreacher': { title: 'Customer Outreacher', subtitle: 'Retention / Feedback Support' },
  'bi-analyst': { title: 'BI Analyst', subtitle: 'Analytics / Store BI' },
  'skills-developer': { title: 'Skills Developer', subtitle: 'Skills Lab / Self-Learning Loop' },
};

export default function DungeonHub() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setAgents(data || []);
    } catch (err) {
      console.error('Error fetching corporate agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'working':
        return 'border-blue-500 bg-blue-50/50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 animate-pulse';
      case 'error':
        return 'border-red-500 bg-red-50/50 text-red-700 dark:bg-red-950/20 dark:text-red-400';
      case 'idle':
      default:
        return 'border-emerald-500 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400';
    }
  };

  if (loading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-sm text-muted-foreground">
        Loading Corporate Agent Dungeon...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Enterprise Agent Dungeon</h1>
        <p className="text-sm text-muted-foreground">Monitor decentralized departments, compliance, and learning systems.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => {
          const dept = DEPARTMENT_MAP[agent.name] || {
            title: agent.name.replace(/-/g, ' '),
            subtitle: 'Department Unassigned',
          };

          return (
            <div
              key={agent.id}
              className={`border rounded-lg p-5 transition-all duration-300 ${getStatusColor(agent.status)}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs uppercase font-mono tracking-wider opacity-60">
                    {agent.business} | {dept.subtitle}
                  </span>
                  <h3 className="text-lg font-semibold capitalize mt-0.5">
                    {dept.title}
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium border border-current">
                  {agent.status}
                </span>
              </div>

              <div className="space-y-3 text-sm opacity-90">
                <div>
                  <span className="block text-xs font-semibold opacity-60">Current/Last Task</span>
                  <span className="line-clamp-2 mt-0.5">{agent.last_task || 'None'}</span>
                </div>

                <div>
                  <span className="block text-xs font-semibold opacity-60">Last Run</span>
                  <span className="mt-0.5 block">
                    {agent.last_run ? new Date(agent.last_run).toLocaleString() : 'Never'}
                  </span>
                </div>

                {agent.status === 'error' && agent.error_message && (
                  <div className="mt-4 p-3 bg-red-100/50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-xs text-red-800 dark:text-red-300 break-words">
                    <strong>Error details:</strong> {agent.error_message}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
