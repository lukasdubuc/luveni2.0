const deleteOrder = async (id: string) => {
  if (!confirm("PERMANENT_ERASURE_CONFIRM?")) return;
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) {
    toast.error("ERASURE_FAILED");
  } else {
    toast.success("RECORD_PURGED");
    syncHub(); // This is your existing function to refresh the list
  }
};

const purgeCancelled = async (status: string) => {
  if (!confirm(`PURGE_ALL_${status.toUpperCase()}_RECORDS?`)) return;
  const { error } = await supabase.from("orders").delete().eq("status", status);
  if (error) {
    toast.error("PURGE_FAILED");
  } else {
    toast.info(`${status.toUpperCase()}_CLEANUP_COMPLETE`);
    syncHub();
  }
};
