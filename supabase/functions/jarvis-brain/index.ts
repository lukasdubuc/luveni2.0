// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM | supabase/functions/jarvis-google/index.ts
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization',
};

/**
 * Strips conversational filler and stop-words from long queries
 * to make them highly searchable for DuckDuckGo and Wikipedia.
 */
function cleanQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.split(/\s+/).length <= 4) return trimmed;

  const stopWords = new Set([
    "the", "a", "an", "of", "to", "for", "in", "is", "as", "at", "by", "from", "on", 
    "with", "about", "current", "results", "official", "please", "can", "you", "search", 
    "and", "tell", "me", "more", "here", "there", "find", "who", "what", "where", "info"
  ]);

  const keywords = trimmed
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
    .split(/\s+/)
    .filter(word => !stopWords.has(word))
    .slice(0, 5);

  return keywords.join(" ") || trimmed;
}

/**
 * Scrapes, cleans, and extracts readable text from any specific URL link.
 */
async function readWebPage(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      return `Error: Failed to fetch webpage at ${url}. Status code: ${response.status}`;
    }

    let html = await response.text();

    html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
    html = html.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "");
    html = html.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "");

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const contentToParse = bodyMatch ? bodyMatch[1] : html;

    let text = contentToParse
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length > 5000) {
      text = text.substring(0, 5000) + "... [Content truncated due to page length]";
    }

    return text || "Webpage was fetched successfully, but no readable text content was found.";

  } catch (error: any) {
    return `Error loading URL: ${error.message}`;
  }
}

/**
 * Resilient web search query executor.
 */
async function executeKeylessSearch(query: string): Promise<string> {
  const results: string[] = [];
  const optimizedQuery = cleanQuery(query);

  if (!optimizedQuery) {
    return "Error: Empty search query.";
  }

  console.log(`[Search] Original Query: "${query}" -> Optimized Query: "${optimizedQuery}"`);

  // Source 1: DuckDuckGo Lite
  try {
    const response = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: `q=${encodeURIComponent(optimizedQuery)}`
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
    }
  } catch (e: any) {
    console.error("[Search] DDG Lite search failed:", e.message);
  }

  // Source 2: Wikipedia Search API
  try {
    if (results.length < 2) {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(optimizedQuery)}&format=json&origin=*`;
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
        }
      }
    }
  } catch (e: any) {
    console.error("[Search] Wikipedia search failed:", e.message);
  }

  if (results.length === 0) {
    console.log(`[Search] Search executed but returned 0 results for: "${optimizedQuery}"`);
    return `Search query: "${optimizedQuery}" executed successfully, but returned 0 public records from DuckDuckGo and Wikipedia. This implies there are no public archives matching this term.`;
  }

  return results.join("\n\n---\n\n");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tool, args } = await req.json()

    // 1. Handle Web Searches
    if (tool === 'google_search') {
      let searchQuery = '';
      if (args) {
        searchQuery = args.query || args.search_query || args.q || args.text || '';
        
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

    // 2. Handle Web Link Scraping
    if (tool === 'open_link') {
      const url = args?.url;
      if (!url) {
        return new Response(
          JSON.stringify({ error: "No URL parameter provided to open." }), 
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      console.log(`[Overseer] Opening URL to scrape: "${url}"`);
      const pageContent = await readWebPage(url);

      return new Response(
        JSON.stringify({ results: pageContent }), 
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
