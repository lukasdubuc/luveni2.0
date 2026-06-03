import { supabase } from "@/integrations/supabase/client";

function getOrCreateSession(): string {
  let sid = sessionStorage.getItem("_sid");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("_sid", sid);
  }
  return sid;
}

export async function trackEvent(
  type: "page_view" | "product_click" | "add_to_cart" | "checkout_start" | "purchase",
  data: { product_id?: string } = {}
) {
  try {
    await supabase.from("page_events").insert([{
      event_type: type,
      path: window.location.pathname,
      session_id: getOrCreateSession(),
      referrer: document.referrer || null,
      ...data,
    }]);
  } catch {
    // fail silently — never block user interactions
  }
}
