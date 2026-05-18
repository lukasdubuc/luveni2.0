import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      setLeads(data || []);
      setLoading(false);
    };
    fetchLeads();
  }, []);

  if (loading) return (
    <div className="p-20 text-center animate-pulse font-mono text-[10px] tracking-[0.8em] uppercase">
      Syncing_Leads...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFBFB] p-8 font-sans text-black">
      <div className="max-w-7xl mx-auto border-b border-black/10 pb-8 mb-12">
        <h1 className="text-4xl font-light tracking-tighter uppercase italic leading-none">Lead_Intake</h1>
        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.4em] opacity-30 mt-3">Active_Capture // Tulsa_Unit</p>
      </div>

      <div className="max-w-7xl mx-auto space-y-4">
        {leads.length === 0 ? (
          <p className="text-[10px] font-mono uppercase opacity-30 tracking-widest text-center py-20">Zero_Leads_Captured</p>
        ) : (
          leads.map((l) => (
            <div key={l.id} className="p-6 border border-black/10 bg-white shadow-sm flex justify-between items-center group hover:border-black transition-all">
              <div>
                <p className="text-[9px] font-mono font-bold uppercase opacity-30 tracking-widest mb-1">
                  {new Date(l.created_at).toLocaleDateString()} // {new Date(l.created_at).toLocaleTimeString()}
                </p>
                <h3 className="font-bold uppercase text-sm tracking-tight">{l.email}</h3>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-bold border border-black/10 px-2 py-1 uppercase opacity-40">
                  Source: {l.source ?? "DIRECT"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
