// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | supabase/functions/jarvis-google/index.ts
// ─────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Resilient web search query executor.
 * Combines POST-based DuckDuckGo Lite scraping and public Wikipedia Search API.
 * Bypasses cloud IP blocking completely without requiring paid search API keys.
 */
async function executeKeylessSearch(query: string): Promise<string> {
  const results: string[] = [];
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return "Error: Empty search query.";
  }

  console.log(`[Search] Executing free search for query: "${trimmedQuery}"`);

  // Source 1: DuckDuckGo Lite (POST request bypasses typical GET cloud IP blocks)
  try {
    const response = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: `q=${encodeURIComponent(trimmedQuery)}`
    });

    if (response.ok) {
      const html = await response.text();
      const links: { title: string; url: string }[] = [];
      const snippets: string[] = [];

      let match;
      const linkRegex = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = linkRegex.exec(html)) !== null && links.length < 3) {
        let url = match[1];
        if (url.includes("uddg=")) {
          const urlParam = url.split("uddg=")[1];
          if (urlParam) {
            url = decodeURIComponent(urlParam.split("&")[0]);
          }
        }
        const title = match[2].replace(/<[^>]*>/g, "").trim();
        links.push({ title, url });
      }

      const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
      while ((match = snippetRegex.exec(html)) !== null && snippets.length < 3) {
        const snippet = match[1].replace(/<[^>]*>/g, "").trim();
        snippets.push(snippet);
      }

      for (let i = 0; i < links.length; i++) {
        results.push(`[Web Result #${i + 1}]\nTitle: ${links[i].title}\nURL: ${links[i].url}\nExtract: ${snippets[i] || 'No summary available.'}`);
      }
      console.log(`[Search] DDG Lite returned ${links.length} results.`);
    }
  } catch (e: any) {
    console.error("[Search] DDG Lite search failed:", e.message);
  }

  // Source 2: Wikipedia Search API (100% resilient fallback, never blocks cloud IPs)
  try {
    if (results.length < 2) {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmedQuery)}&format=json&origin=*`;
      const response = await fetch(wikiUrl, {
        headers: { "User-Agent": "JARVIS-Bot/1.0 (contact: support@luveni.com)" }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.query && data.query.search) {
          const wikiItems = data.query.search.slice(0, 2);
          wikiItems.forEach((item: any, idx: number) => {
            const snippet = item.snippet.replace(/<[^>]*>/g, "").trim();
            const link = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`;
            results.push(`[Wikipedia Result #${idx + 1}]\nTitle: ${item.title}\nURL: ${link}\nSummary: ${snippet}...`);
          });
          console.log(`[Search] Wikipedia API returned ${wikiItems.length} results.`);
        }
      }
    }
  } catch (e: any) {
    console.error("[Search] Wikipedia search failed:", e.message);
  }

  if (results.length === 0) {
    return "Error: Web search was unable to retrieve live data. Inform the user that direct search retrieval is offline, sir.";
  }

  return results.join("\n\n---\n\n");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tool, args } = await req.json()

    if (tool === 'google_search') {
      let searchQuery = '';
      if (args) {
        // Robust Extraction: Handle standard parameter names as well as conversational variations
        searchQuery = args.query || args.search_query || args.q || args.text || '';
        
        // Fuzzy Fallback: Grab the first string parameter if the model mismatched the key name
        if (!searchQuery && typeof args === 'object') {
          const values = Object.values(args);
          const firstString = values.find(val => typeof val === 'string');
          if (firstString) {
            searchQuery = firstString as string;
          }
        }
      }

      const searchResults = await executeKeylessSearch(searchQuery);

      return new Response(
        JSON.stringify({ results: searchResults }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ error: `Tool ${tool} is not handled in this function.` }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
})
