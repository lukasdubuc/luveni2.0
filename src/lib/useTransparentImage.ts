// ─────────────────────────────────────────────────────────────
//  Luveni — client-side background removal for storefront imagery
//  Runs @imgly/background-removal in the browser so every product photo
//  ends up on a transparent background regardless of the source vendor
//  (Printful ships transparent PNGs already; CJ ships opaque JPGs on a
//  studio backdrop). No server pipeline involved.
//
//  Designed to never block the UI:
//    • already-transparent sources are returned untouched (no work);
//    • results are cached in-memory per source URL for the session, so
//      repeat views and re-renders are instant;
//    • processing is queued with a small concurrency cap so a grid of
//      images can't peg the main thread;
//    • the original image is shown until the cut-out is ready, and any
//      failure silently falls back to the original.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { isLikelyTransparentImage } from "./img";

// source URL → object URL of the transparent PNG (or "" while pending/failed)
const _cache = new Map<string, string>();
const _inflight = new Map<string, Promise<string>>();

let _active = 0;
const _MAX = 2;
const _waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (_active < _MAX) {
    _active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => _waiters.push(resolve));
}

function release() {
  _active = Math.max(0, _active - 1);
  const next = _waiters.shift();
  if (next) {
    _active++;
    next();
  }
}

async function process(src: string): Promise<string> {
  await acquire();
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    const blob = await removeBackground(src);
    const url = URL.createObjectURL(blob);
    _cache.set(src, url);
    return url;
  } catch (e) {
    console.warn("background removal failed, keeping original", e);
    _cache.set(src, ""); // remember the failure so we don't retry forever
    return "";
  } finally {
    release();
  }
}

/**
 * Returns a transparent-background version of `src` when possible, falling back
 * to `src` itself. `enabled` lets callers defer work until the image is in view.
 * `transparent` reflects whether the returned URL is a real cut-out, so callers
 * can drop any solid-tile framing once transparency is available.
 */
export function useTransparentImage(
  src: string | undefined,
  enabled = true,
): { url: string | undefined; transparent: boolean } {
  const alreadyTransparent = !!src && isLikelyTransparentImage(src);
  const [url, setUrl] = useState<string | undefined>(src);
  const [transparent, setTransparent] = useState<boolean>(alreadyTransparent);

  useEffect(() => {
    setUrl(src);
    setTransparent(alreadyTransparent);
    if (!src || !enabled || alreadyTransparent) return;

    const cached = _cache.get(src);
    if (cached) {
      setUrl(cached);
      setTransparent(true);
      return;
    }
    if (cached === "") return; // known failure — keep original

    let alive = true;
    const p = _inflight.get(src) ?? process(src);
    _inflight.set(src, p);
    p.then((out) => {
      _inflight.delete(src);
      if (alive && out) {
        setUrl(out);
        setTransparent(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [src, enabled, alreadyTransparent]);

  return { url, transparent };
}
