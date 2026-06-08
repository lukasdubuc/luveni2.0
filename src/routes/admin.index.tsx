import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts } from "@/lib/useProducts";
import { offer } from "@/config/site";
import { toast } from "sonner";
import {
  Edit3, Archive, X, Menu, RefreshCw, BarChart2, Lock,
  CheckSquare, Square, Trash2, Eye, EyeOff, GripVertical,
  Users, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin-guard";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL DECORATIVE STYLES  (injected once, zero runtime cost)
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');

  .adm-root {
    --c-bg:       #04070d;
    --c-panel:    #080e1a;
    --c-border:   #0d2137;
    --c-border2:  #0e3a5c;
    --c-cyan:     #00e5ff;
    --c-cyan2:    #00b4cc;
    --c-green:    #00ff88;
    --c-amber:    #ffb700;
    --c-red:      #ff3860;
    --c-purple:   #b44fff;
    --c-text:     #c8e6f7;
    --c-muted:    #3a6480;
    --font-hud:   'Share Tech Mono', monospace;
    --font-title: 'Orbitron', monospace;
  }

  /* ── LIGHT OVERRIDE ── */
  .adm-root.light {
    --c-bg:      #f0f4f8;
    --c-panel:   #ffffff;
    --c-border:  #d0dce8;
    --c-border2: #a8c0d6;
    --c-cyan:    #0077aa;
    --c-cyan2:   #005580;
    --c-green:   #00884d;
    --c-amber:   #c47a00;
    --c-red:     #cc1a3a;
    --c-purple:  #7b22cc;
    --c-text:    #1a2a3a;
    --c-muted:   #6a8aaa;
  }

  .adm-root * { box-sizing: border-box; margin: 0; padding: 0; }
  .adm-root { font-family: var(--font-hud); background: var(--c-bg); color: var(--c-text); min-height: 100vh; position: relative; overflow-x: hidden; }

  /* ── HEX-GRID BACKGROUND ── */
  .adm-hexbg {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 0 l28 16 0 33 -28 17 -28-17 0-33z' fill='none' stroke='%230d2137' stroke-width='0.6'/%3E%3C/svg%3E");
    background-size: 56px 100px;
    opacity: 0.6;
  }
  .adm-root.light .adm-hexbg { opacity: 0.3; }

  /* ── SCANLINE OVERLAY ── */
  .adm-scan {
    position: fixed; inset: 0; pointer-events: none; z-index: 1;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px);
  }
  .adm-root.light .adm-scan { opacity: 0.25; }

  /* ── TOP ACCENT LINE ── */
  .adm-topline {
    position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: 100;
    background: linear-gradient(90deg, transparent, var(--c-cyan), var(--c-purple), var(--c-cyan), transparent);
    animation: adm-slide 4s linear infinite;
  }
  @keyframes adm-slide { 0%{background-position:-100%} 100%{background-position:200%} }

  /* ── CORNER BRACKETS ── */
  .adm-bracket {
    position: absolute; width: 16px; height: 16px; pointer-events: none;
  }
  .adm-bracket.tl { top: 0; left: 0; border-top: 1.5px solid var(--c-cyan); border-left: 1.5px solid var(--c-cyan); }
  .adm-bracket.tr { top: 0; right: 0; border-top: 1.5px solid var(--c-cyan); border-right: 1.5px solid var(--c-cyan); }
  .adm-bracket.bl { bottom: 0; left: 0; border-bottom: 1.5px solid var(--c-cyan); border-left: 1.5px solid var(--c-cyan); }
  .adm-bracket.br { bottom: 0; right: 0; border-bottom: 1.5px solid var(--c-cyan); border-right: 1.5px solid var(--c-cyan); }

  /* ── NAV ── */
  .adm-nav {
    position: sticky; top: 0; z-index: 50;
    background: rgba(4,7,13,0.92); border-bottom: 1px solid var(--c-border2);
    backdrop-filter: blur(12px);
    padding: 0 24px;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    height: 52px;
  }
  .adm-root.light .adm-nav { background: rgba(240,244,248,0.92); }
  .adm-nav-brand {
    font-family: var(--font-title); font-size: 11px; font-weight: 700;
    color: var(--c-cyan); letter-spacing: 0.25em;
    display: flex; align-items: center; gap: 8px;
    text-shadow: 0 0 12px var(--c-cyan);
  }
  .adm-root.light .adm-nav-brand { text-shadow: none; }
  .adm-nav-links { display: flex; align-items: center; gap: 6px; }
  .adm-nav-btn {
    font-family: var(--font-hud); font-size: 10px; letter-spacing: 0.14em;
    padding: 6px 14px; background: transparent; border: 1px solid transparent;
    color: var(--c-muted); cursor: pointer; transition: all 0.2s; text-transform: uppercase;
    position: relative;
  }
  .adm-nav-btn:hover { color: var(--c-cyan); border-color: var(--c-border2); }
  .adm-nav-btn.active {
    color: var(--c-cyan); border-color: var(--c-cyan2);
    background: rgba(0,229,255,0.05);
    text-shadow: 0 0 8px var(--c-cyan);
  }
  .adm-root.light .adm-nav-btn.active { text-shadow: none; background: rgba(0,119,170,0.08); }

  /* ── JARVIS BUTTON ── */
  .adm-jarvis-btn {
    font-family: var(--font-title); font-size: 9px; font-weight: 700;
    padding: 7px 16px; border: 1px solid var(--c-purple);
    background: rgba(180,79,255,0.08); color: var(--c-purple);
    cursor: pointer; letter-spacing: 0.18em; text-transform: uppercase;
    transition: all 0.2s;
    clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
  }
  .adm-jarvis-btn:hover { background: rgba(180,79,255,0.18); box-shadow: 0 0 20px rgba(180,79,255,0.3); }

  /* ── MAIN LAYOUT ── */
  .adm-main { max-width: 1400px; margin: 0 auto; padding: 28px 24px 60px; position: relative; z-index: 2; }

  /* ── SECTION HEADING ── */
  .adm-heading {
    font-family: var(--font-title); font-size: 13px; font-weight: 700;
    letter-spacing: 0.2em; color: var(--c-cyan); text-transform: uppercase;
    display: flex; align-items: center; gap: 10px;
  }
  .adm-heading::before { content: '//'; color: var(--c-muted); font-family: var(--font-hud); font-size: 11px; }
  .adm-subheading {
    font-size: 9px; letter-spacing: 0.2em; color: var(--c-muted); text-transform: uppercase; margin-top: 3px;
  }

  /* ── PANEL CARD ── */
  .adm-panel {
    background: var(--c-panel); border: 1px solid var(--c-border);
    position: relative; overflow: hidden;
    transition: border-color 0.2s;
  }
  .adm-panel:hover { border-color: var(--c-border2); }
  .adm-panel::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--c-cyan2), transparent);
    opacity: 0.4;
  }
  .adm-root.light .adm-panel::before { opacity: 0.6; }

  /* ── LED DOTS ── */
  .adm-led {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    animation: adm-pulse 2s ease-in-out infinite;
  }
  @keyframes adm-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .adm-led-g  { background: var(--c-green);  box-shadow: 0 0 6px var(--c-green);  }
  .adm-led-c  { background: var(--c-cyan);   box-shadow: 0 0 6px var(--c-cyan);   }
  .adm-led-a  { background: var(--c-amber);  box-shadow: 0 0 6px var(--c-amber);  }
  .adm-led-r  { background: var(--c-red);    box-shadow: 0 0 6px var(--c-red);    }
  .adm-led-p  { background: var(--c-purple); box-shadow: 0 0 6px var(--c-purple); }
  .adm-led-n  { background: var(--c-muted);  box-shadow: none; animation: none; }
  .adm-root.light .adm-led { box-shadow: none !important; }

  /* ── STAT CARD ── */
  .adm-stat {
    padding: 16px 18px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .adm-stat-label {
    font-size: 9px; letter-spacing: 0.2em; color: var(--c-muted); text-transform: uppercase;
    display: flex; align-items: center; justify-content: space-between;
  }
  .adm-stat-val {
    font-family: var(--font-title); font-size: 26px; font-weight: 700;
    color: var(--c-text); letter-spacing: 0.04em; line-height: 1;
  }
  .adm-stat-sub { font-size: 9px; color: var(--c-muted); letter-spacing: 0.1em; }

  /* ── WAVEFORM / SPARKLINE ── */
  .adm-wave-wrap { position: relative; height: 56px; overflow: hidden; }
  .adm-wave-svg { width: 100%; height: 100%; }

  /* ── OSCILLOSCOPE RING ── */
  .adm-osc-wrap { position: relative; width: 100%; height: 80px; overflow: hidden; }
  .adm-osc-line { position: absolute; inset: 0; }

  /* ── RADAR ── */
  .adm-radar-wrap {
    position: relative; width: 120px; height: 120px; flex-shrink: 0;
  }
  .adm-radar-svg { width: 100%; height: 100%; }
  .adm-radar-sweep {
    transform-origin: 60px 60px;
    animation: adm-radar-rot 3s linear infinite;
  }
  @keyframes adm-radar-rot { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

  /* ── MATRIX RAIN CANVAS ── */
  .adm-matrix-wrap {
    position: relative; overflow: hidden;
    border-right: 1px solid var(--c-border);
  }
  .adm-matrix-canvas { display: block; opacity: 0.55; }
  .adm-root.light .adm-matrix-canvas { opacity: 0.18; }

  /* ── TELEMETRY PIPELINE ── */
  .adm-tele-pipe {
    display: flex; align-items: center; gap: 0; padding: 20px 24px;
  }
  .adm-tele-node {
    display: flex; flex-direction: column; align-items: center; gap: 5px;
    flex: 1;
  }
  .adm-tele-dot {
    width: 12px; height: 12px; border-radius: 50%; border: 2px solid;
    position: relative; z-index: 2; background: var(--c-panel);
    transition: box-shadow 0.3s;
  }
  .adm-tele-dot.c  { border-color: var(--c-cyan);   box-shadow: 0 0 10px var(--c-cyan);   }
  .adm-tele-dot.a  { border-color: var(--c-amber);  box-shadow: 0 0 10px var(--c-amber);  }
  .adm-tele-dot.g  { border-color: var(--c-green);  box-shadow: 0 0 10px var(--c-green);  }
  .adm-tele-dot.n  { border-color: var(--c-border2); box-shadow: none; }
  .adm-root.light .adm-tele-dot { box-shadow: none !important; }
  .adm-tele-connector {
    flex: 1; height: 1px; position: relative; margin-bottom: 17px;
  }
  .adm-tele-connector-line {
    position: absolute; inset: 0; background: var(--c-border2);
  }
  .adm-tele-packet {
    position: absolute; top: -2px; width: 5px; height: 5px; border-radius: 50%;
    animation: adm-packet-move 2s linear infinite;
  }
  .adm-tele-packet.c { background: var(--c-cyan);  box-shadow: 0 0 6px var(--c-cyan);  }
  .adm-tele-packet.a { background: var(--c-amber); box-shadow: 0 0 6px var(--c-amber); }
  .adm-tele-packet.g { background: var(--c-green); box-shadow: 0 0 6px var(--c-green); }
  .adm-root.light .adm-tele-packet { box-shadow: none !important; }
  @keyframes adm-packet-move { 0%{left:-1%} 100%{left:100%} }
  .adm-tele-label { font-size: 9px; letter-spacing: 0.15em; color: var(--c-muted); text-transform: uppercase; }
  .adm-tele-count { font-family: var(--font-title); font-size: 13px; color: var(--c-text); }

  /* ── FUNNEL BARS ── */
  .adm-funnel-bar-bg { height: 5px; background: var(--c-border); border-radius: 0; overflow: hidden; flex: 1; }
  .adm-funnel-bar-fill { height: 100%; transition: width 0.8s cubic-bezier(0.16,1,0.3,1); }

  /* ── TICKER TAPE ── */
  .adm-ticker {
    overflow: hidden; white-space: nowrap; font-size: 9px; letter-spacing: 0.12em;
    color: var(--c-muted); padding: 6px 0; border-top: 1px solid var(--c-border);
    border-bottom: 1px solid var(--c-border);
  }
  .adm-ticker-inner { display: inline-block; animation: adm-ticker-scroll 28s linear infinite; }
  @keyframes adm-ticker-scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }

  /* ── STATUS BADGE ── */
  .adm-badge {
    font-size: 8px; letter-spacing: 0.16em; padding: 2px 8px; text-transform: uppercase;
    clip-path: polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%);
  }
  .adm-badge-g { background: rgba(0,255,136,0.12); color: var(--c-green); }
  .adm-badge-a { background: rgba(255,183,0,0.12);  color: var(--c-amber); }
  .adm-badge-r { background: rgba(255,56,96,0.12);  color: var(--c-red);   }

  /* ── TABLES ── */
  .adm-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .adm-table th {
    font-size: 9px; letter-spacing: 0.18em; color: var(--c-muted); text-transform: uppercase;
    padding: 10px 16px; border-bottom: 1px solid var(--c-border); text-align: left;
    font-weight: 400;
  }
  .adm-table td { padding: 12px 16px; border-bottom: 1px solid var(--c-border); }
  .adm-table tr:last-child td { border-bottom: none; }
  .adm-table tr { cursor: pointer; transition: background 0.15s; }
  .adm-table tr:hover td { background: rgba(0,229,255,0.03); }
  .adm-root.light .adm-table tr:hover td { background: rgba(0,119,170,0.04); }

  /* ── PRODUCT CARD ── */
  .adm-product-card {
    border: 1px solid var(--c-border); background: var(--c-panel);
    transition: border-color 0.2s, transform 0.2s;
    overflow: hidden; position: relative;
  }
  .adm-product-card:hover { border-color: var(--c-cyan2); transform: translateY(-2px); }
  .adm-product-card.selected { border-color: var(--c-cyan); box-shadow: 0 0 16px rgba(0,229,255,0.15); }
  .adm-root.light .adm-product-card.selected { box-shadow: none; }
  .adm-product-card.drag-over { border-color: var(--c-purple); }

  /* ── FORM INPUTS ── */
  .adm-input-wrap { display: flex; flex-direction: column; gap: 6px; }
  .adm-input-label { font-size: 9px; letter-spacing: 0.18em; color: var(--c-muted); text-transform: uppercase; }
  .adm-input {
    background: transparent; border: none; border-bottom: 1px solid var(--c-border2);
    color: var(--c-text); font-family: var(--font-hud); font-size: 12px;
    padding: 8px 0; outline: none; width: 100%; letter-spacing: 0.06em;
    transition: border-color 0.2s;
  }
  .adm-input:focus { border-bottom-color: var(--c-cyan); }
  .adm-textarea {
    background: rgba(0,229,255,0.02); border: 1px solid var(--c-border2);
    color: var(--c-text); font-family: var(--font-hud); font-size: 11px;
    padding: 10px; outline: none; width: 100%; resize: none; letter-spacing: 0.04em;
    transition: border-color 0.2s;
  }
  .adm-textarea:focus { border-color: var(--c-cyan); }
  .adm-root.light .adm-textarea { background: rgba(0,119,170,0.03); }

  /* ── BUTTONS ── */
  .adm-btn {
    font-family: var(--font-hud); font-size: 10px; letter-spacing: 0.16em;
    text-transform: uppercase; padding: 10px 20px; cursor: pointer;
    border: 1px solid var(--c-border2); background: transparent; color: var(--c-text);
    transition: all 0.2s;
  }
  .adm-btn:hover { border-color: var(--c-cyan); color: var(--c-cyan); background: rgba(0,229,255,0.04); }
  .adm-btn-primary {
    background: var(--c-cyan); color: #04070d; border-color: var(--c-cyan);
    font-weight: 700;
  }
  .adm-btn-primary:hover { background: var(--c-cyan2); border-color: var(--c-cyan2); color: #04070d; box-shadow: 0 0 20px rgba(0,229,255,0.3); }
  .adm-root.light .adm-btn-primary:hover { box-shadow: none; }
  .adm-btn-danger { border-color: var(--c-red); color: var(--c-red); }
  .adm-btn-danger:hover { background: rgba(255,56,96,0.08); }
  .adm-btn-active { border-color: var(--c-cyan); color: var(--c-cyan); background: rgba(0,229,255,0.06); }

  /* ── RANGE SLIDER ── */
  .adm-period-bar { display: flex; gap: 4px; }
  .adm-period-btn {
    font-family: var(--font-hud); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase;
    padding: 5px 12px; cursor: pointer; border: 1px solid var(--c-border);
    background: transparent; color: var(--c-muted); transition: all 0.2s;
  }
  .adm-period-btn.active { border-color: var(--c-cyan2); color: var(--c-cyan); background: rgba(0,229,255,0.06); }

  /* ── MODAL ── */
  .adm-modal-backdrop {
    position: fixed; inset: 0; z-index: 100;
    background: rgba(4,7,13,0.88); backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .adm-root.light .adm-modal-backdrop { background: rgba(240,244,248,0.88); }
  .adm-modal {
    background: var(--c-panel); border: 1px solid var(--c-border2);
    width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto;
    position: relative;
  }
  .adm-modal::before {
    content:''; position: absolute; top:0; left:0; right:0; height:2px;
    background: linear-gradient(90deg, var(--c-cyan), var(--c-purple));
  }

  /* ── MOBILE MENU ── */
  .adm-mobile-menu {
    background: var(--c-panel); border-bottom: 1px solid var(--c-border);
    padding: 16px 24px; display: flex; flex-direction: column; gap: 4px;
  }

  /* ── MISC ── */
  .adm-divider { height: 1px; background: var(--c-border); }
  .adm-code-block {
    background: rgba(0,0,0,0.4); border: 1px solid var(--c-border);
    font-size: 9px; color: var(--c-cyan2); padding: 14px; overflow-x: auto;
    line-height: 1.7; letter-spacing: 0.04em;
  }
  .adm-root.light .adm-code-block { background: rgba(0,119,170,0.05); color: var(--c-cyan2); }
  .adm-empty { text-align: center; padding: 40px; font-size: 10px; letter-spacing: 0.2em; color: var(--c-muted); }

  .adm-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .adm-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .adm-grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
  .adm-grid-prod { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }
  @media(max-width:768px) {
    .adm-grid-4 { grid-template-columns: repeat(2,1fr); }
    .adm-grid-5 { grid-template-columns: repeat(2,1fr); }
    .adm-grid-2 { grid-template-columns: 1fr; }
    .adm-nav-links { display: none; }
    .adm-nav-links.open { display: flex; flex-direction: column; }
  }

  /* ── CORNER CHIP ── */
  .adm-chip {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 8px; letter-spacing: 0.16em; text-transform: uppercase;
    padding: 3px 8px; border: 1px solid; color: var(--c-cyan); border-color: var(--c-border2);
    background: rgba(0,229,255,0.04);
  }

  /* ── SELECT OVERLAY ── */
  .adm-select-bar {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 10px 16px; border: 1px solid var(--c-border2);
    background: rgba(0,229,255,0.03); margin-bottom: 8px;
    animation: adm-fade-in 0.2s ease;
  }
  @keyframes adm-fade-in { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

  /* ── LIVE STATUS INDICATOR ── */
  .adm-live { display: flex; align-items: center; gap: 6px; font-size: 9px; letter-spacing: 0.15em; color: var(--c-green); }

  /* ── TAB BAR ── */
  .adm-tabbar { display: flex; border-bottom: 1px solid var(--c-border); }
  .adm-tab {
    font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase;
    padding: 10px 18px; cursor: pointer; border-bottom: 2px solid transparent;
    color: var(--c-muted); background: transparent; border-top:none; border-left:none; border-right:none;
    display: flex; align-items: center; gap: 6px; transition: all 0.18s; margin-bottom: -1px;
  }
  .adm-tab:hover { color: var(--c-cyan); }
  .adm-tab.active { color: var(--c-cyan); border-bottom-color: var(--c-cyan); }
  .adm-tab-count {
    font-size: 8px; padding: 1px 5px;
    background: rgba(0,229,255,0.1); color: var(--c-cyan); border-radius: 2px;
  }
  .adm-tab.active .adm-tab-count { background: var(--c-cyan); color: #04070d; }

  /* ── SEARCH INPUT ── */
  .adm-search {
    background: transparent; border: none; border-bottom: 1px solid var(--c-border2);
    color: var(--c-text); font-family: var(--font-hud); font-size: 10px;
    padding: 6px 0; outline: none; width: 200px; letter-spacing: 0.08em;
  }
  .adm-search::placeholder { color: var(--c-muted); }
  .adm-search:focus { border-bottom-color: var(--c-cyan); }

  /* analytics chart */
  .adm-bar-chart { display: flex; align-items: flex-end; gap: 2px; height: 96px; }
  .adm-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .adm-bar { width: 100%; min-height: 2px; transition: height 0.5s ease; border-top: 1px solid; }
  .adm-bar-lbl { font-size: 7px; color: var(--c-muted); letter-spacing: 0.06em; }

  /* revenue waveform canvas */
  .adm-wave-canvas { width: 100%; height: 56px; display: block; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type SiteContent = {
  hero_headline: string; hero_subheadline: string; hero_cta: string;
  price_display: string; price_original: string; launch_pricing_active: boolean;
  guarantee_days: number; theme?: string; metadata?: any;
};
type Product = {
  id: string; title: string; slug: string; price_cents: number;
  image_urls: string[]; is_published: boolean; description?: string;
  printful_id?: string | null; display_order?: number;
};
type Order   = { id: string; email: string; name?: string; amount_cents: number; status: string; created_at: string; };
type Lead    = { id: string; email: string; created_at: string; };
type PageEvent = { id: string; event_type: string; path: string; product_id?: string; session_id?: string; referrer?: string; country?: string; created_at: string; };
type AdminUser = { id: string; email: string; role: "admin"|"manager"|"viewer"; created_at: string; };
type NavSection = "overview"|"products"|"orders"|"leads"|"analytics"|"settings";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin" }] }),
  beforeLoad: requireAdmin,
  component: AdminPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// DECORATIVE COMPONENTS (pure UI, zero data dependency)
// ─────────────────────────────────────────────────────────────────────────────

/** Matrix rain canvas — purely decorative column accent */
function MatrixRain({ width = 80, height = 300, isDark }: { width?: number; height?: number; isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = width;
    canvas.height = height;
    const cols = Math.floor(width / 12);
    const drops = Array(cols).fill(1);
    const chars = "アイウエオカキクケコ0123456789ABCDEF>_<[]{}|/\\";
    const tick = setInterval(() => {
      ctx.fillStyle = isDark ? "rgba(4,7,13,0.08)" : "rgba(240,244,248,0.08)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = isDark ? "#00ff8844" : "#00884d44";
      ctx.font = "11px 'Share Tech Mono', monospace";
      drops.forEach((y, i) => {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = isDark ? "#00ff8866" : "#00884d66";
        ctx.fillText(ch, i * 12, y * 12);
        if (y * 12 > height && Math.random() > 0.97) drops[i] = 0;
        drops[i]++;
      });
    }, 60);
    return () => clearInterval(tick);
  }, [isDark, width, height]);
  return <canvas ref={canvasRef} className="adm-matrix-canvas" style={{ width, height }} />;
}

/** Animated waveform for revenue sparkline */
function WaveformCanvas({ data, color, height = 56 }: { data: number[]; color: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);
  const offsetRef = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    canvas.width  = w * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    const max = Math.max(...data, 1);
    const draw = () => {
      ctx.clearRect(0, 0, w, height);
      const pts: [number, number][] = data.map((v, i) => [
        (i / (data.length - 1)) * w,
        height - 8 - ((v / max) * (height - 16)),
      ]);
      // filled area
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, color + "44");
      grad.addColorStop(1, color + "00");
      ctx.beginPath();
      ctx.moveTo(0, height);
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(w, height);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      // line
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.stroke();
      // animated scan dot
      const pct = ((offsetRef.current % 100) / 100);
      const si = Math.floor(pct * (pts.length - 1));
      const [dx, dy] = pts[Math.min(si, pts.length - 1)];
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dx, dy, 6, 0, Math.PI * 2);
      ctx.strokeStyle = color + "55";
      ctx.lineWidth = 1;
      ctx.stroke();
      offsetRef.current += 0.5;
      frameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [data, color, height]);
  return <canvas ref={canvasRef} className="adm-wave-canvas" style={{ height }} />;
}

/** Radar sweep — decorative */
function RadarDisplay({ isDark }: { isDark: boolean }) {
  const rings = [0.25, 0.5, 0.75, 1];
  const cx = 60, cy = 60, r = 54;
  const c = isDark ? "#00e5ff" : "#0077aa";
  const bg = isDark ? "#080e1a" : "#f0f4f8";
  return (
    <div className="adm-radar-wrap">
      <svg className="adm-radar-svg" viewBox="0 0 120 120">
        <rect width="120" height="120" fill={bg} />
        {rings.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r * s} fill="none" stroke={c} strokeWidth="0.5" opacity="0.3" />
        ))}
        <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={c} strokeWidth="0.4" opacity="0.2" />
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={c} strokeWidth="0.4" opacity="0.2" />
        <g className="adm-radar-sweep">
          <defs>
            <radialGradient id="radg" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
              gradientTransform={`translate(${cx},${cy}) scale(${r})`}>
              <stop offset="0%" stopColor={c} stopOpacity="0.6" />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx + r * 0.87} ${cy + r * 0.5} Z`}
            fill="url(#radg)" />
          <line x1={cx} y1={cy} x2={cx} y2={cy - r} stroke={c} strokeWidth="1.5" opacity="0.8" />
        </g>
        {/* blips */}
        {[[0.4, 0.3],[0.7, 0.6],[0.2, 0.7],[0.8, 0.2]].map(([bx, by], i) => (
          <circle key={i} cx={cx + (bx - 0.5) * r * 2} cy={cy + (by - 0.5) * r * 2}
            r="2.5" fill={i % 2 === 0 ? c : (isDark ? "#00ff88" : "#00884d")} opacity="0.7">
            <animate attributeName="opacity" values="0.7;0.1;0.7" dur={`${1.2 + i * 0.4}s`} repeatCount="indefinite" />
          </circle>
        ))}
        <text x={cx} y={cy + r + 11} textAnchor="middle" fontSize="7" fill={c} opacity="0.5" fontFamily="'Share Tech Mono',monospace">
          RADAR_SCAN
        </text>
      </svg>
    </div>
  );
}

/** Scrolling ticker tape */
function TickerTape({ isDark }: { isDark: boolean }) {
  const items = [
    "SYS_ONLINE", "DB_CONN_OK", "REALTIME_ACTIVE", "PRINTFUL_API_READY",
    "AUTH_SECURE", "CDN_CACHED", "PAYMENTS_LIVE", "WEBHOOK_ARMED",
    "SSL_VALID", "EDGE_FN_WARM", "SUPABASE_LINKED", "METRICS_STREAMING",
  ];
  const text = items.join("  ·  ") + "  ·  " + items.join("  ·  ");
  return (
    <div className="adm-ticker">
      <span className="adm-ticker-inner">{text}&nbsp;&nbsp;&nbsp;&nbsp;{text}</span>
    </div>
  );
}

/** Animated telemetry pipeline nodes */
function TelemetryPipeline({ views, clicks, carts, checkouts, purchases, isDark }: {
  views: number; clicks: number; carts: number; checkouts: number; purchases: number; isDark: boolean;
}) {
  const nodes = [
    { label: "VIEW",     val: views,     cls: "c", delay: "0s"   },
    { label: "CLICK",    val: clicks,    cls: "c", delay: "0.4s" },
    { label: "CART",     val: carts,     cls: "a", delay: "0.8s" },
    { label: "CHECKOUT", val: checkouts, cls: "a", delay: "1.2s" },
    { label: "PAID",     val: purchases, cls: "g", delay: "1.6s" },
  ];
  const connCls = ["c","c","a","g"];
  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {nodes.map((n, i) => (
          <div key={n.label} style={{ display: "contents" }}>
            <div className="adm-tele-node">
              <div className={`adm-tele-dot ${n.cls}`} />
              <span className="adm-tele-label">{n.label}</span>
              <span className="adm-tele-count">{n.val > 0 ? n.val.toLocaleString() : "—"}</span>
            </div>
            {i < nodes.length - 1 && (
              <div className="adm-tele-connector">
                <div className="adm-tele-connector-line" />
                <div className={`adm-tele-packet ${connCls[i]}`}
                  style={{ animationDelay: n.delay, animationDuration: `${1.5 + i * 0.3}s` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Corner brackets around a panel */
function Brackets() {
  return (
    <>
      <div className="adm-bracket tl" />
      <div className="adm-bracket tr" />
      <div className="adm-bracket bl" />
      <div className="adm-bracket br" />
    </>
  );
}

/** LED indicator */
function Led({ color }: { color: "g"|"c"|"a"|"r"|"p"|"n" }) {
  return <span className={`adm-led adm-led-${color}`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STAT / INPUT COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, led = "c" }: { label: string; value: string | number; sub: string; led?: "g"|"c"|"a"|"r"|"p"|"n" }) {
  return (
    <div className="adm-panel adm-stat">
      <Brackets />
      <div className="adm-stat-label">{label} <Led color={led} /></div>
      <div className="adm-stat-val">{value}</div>
      <div className="adm-stat-sub">{sub}</div>
    </div>
  );
}

function StatDelta({ label, value, sub, delta }: { label: string; value: string|number; sub: string; delta: number|null }) {
  const led: "g"|"r"|"n" = delta === null ? "n" : delta > 0 ? "g" : "r";
  return (
    <div className="adm-panel adm-stat">
      <Brackets />
      <div className="adm-stat-label">{label} <Led color={led} /></div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div className="adm-stat-val">{value}</div>
        {delta !== null && (
          <span style={{ fontSize: 10, color: delta > 0 ? "var(--c-green)" : "var(--c-red)", letterSpacing: "0.1em" }}>
            {delta > 0 ? "↑" : "↓"}{Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="adm-stat-sub">{sub}</div>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="adm-input-wrap">
      <label className="adm-input-label">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="adm-input" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ADMIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
function AdminPage() {
  const navigate = useNavigate();
  const navSections: NavSection[] = ["overview","products","orders","leads","analytics","settings"];
  const [section, setSection] = useState<NavSection>("overview");
  const [isDark, setIsDark] = useState<boolean>(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Data ──
  const [products,    setProducts]    = useState<Product[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [activeLeads,  setActiveLeads]  = useState<Lead[]>([]);
  const [userEmail,    setUserEmail]    = useState<string|null>(null);
  const [pageEvents,   setPageEvents]   = useState<PageEvent[]>([]);
  const [adminUsers,   setAdminUsers]   = useState<AdminUser[]>([]);

  // ── Site config ──
  const [siteContent, setSiteContent] = useState<SiteContent>({
    hero_headline:"", hero_subheadline:"", hero_cta:"",
    price_display:"", price_original:"", launch_pricing_active:false,
    guarantee_days:30, theme:"light", metadata:{},
  });
  const [siteSaving, setSiteSaving] = useState(false);

  // ── Product form ──
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    editingId: null as string|null,
    title:"", slug:"", price_cents:"", image_url:"", description:"",
    is_published:true, source_url:"", hasVariants:false, variantsText:"[]",
  });

  // ── Bulk / drag ──
  const [selectMode,   setSelectMode]   = useState(false);
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [isBulkActing, setIsBulkActing] = useState(false);
  const [draggedId,    setDraggedId]    = useState<string|null>(null);
  const [dragOverId,   setDragOverId]   = useState<string|null>(null);
  const [orderedProducts, setOrderedProducts] = useState<Product[]>([]);

  // ── Filters / UI ──
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all"|"paid"|"pending"|"failed">("all");
  const [analyticsRange,    setAnalyticsRange]    = useState<"7"|"14"|"30">("14");
  const [revenueRange,      setRevenueRange]       = useState<"day"|"week"|"month"|"all">("day");
  const [searchQuery,       setSearchQuery]        = useState("");
  const [selectedRow,       setSelectedRow]        = useState<any>(null);
  const [isSyncing,         setIsSyncing]          = useState(false);
  const [newUserEmail,      setNewUserEmail]        = useState("");
  const [newUserRole,       setNewUserRole]         = useState<"admin"|"manager"|"viewer">("viewer");
  const [isAddingUser,      setIsAddingUser]        = useState(false);

  // inject CSS once
  useEffect(() => {
    if (document.getElementById("adm-styles")) return;
    const s = document.createElement("style");
    s.id = "adm-styles";
    s.textContent = ADMIN_CSS;
    document.head.appendChild(s);
  }, []);

  // theme sync
  useEffect(() => {
    if (!localStorage.getItem("theme") && siteContent.theme) {
      const dark = siteContent.theme === "dark";
      document.documentElement.classList.toggle("dark", dark);
      setIsDark(dark);
    }
  }, [siteContent.theme]);

  useEffect(() => {
    setOrderedProducts([...products].sort((a,b) => (a.display_order??999)-(b.display_order??999)));
  }, [products]);

  // ── Auth ──
  useEffect(() => {
    const init = async () => {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) { window.location.href="/login"; return; }
      setUserEmail(user.email||null);
      await fetchData();
    };
    init();
  }, []);

  // ── Realtime ──
  useEffect(() => {
    const up = <T extends {id:string}>(arr:T[],row:T) => {
      const i = arr.findIndex(r=>r.id===row.id);
      if(i===-1) return [row,...arr];
      const n=[...arr]; n[i]={...n[i],...row}; return n;
    };
    const rm = <T extends {id:string}>(arr:T[],id:string) => arr.filter(r=>r.id!==id);
    const ch = supabase.channel("admin_rt")
      .on("postgres_changes",{event:"*",schema:"public",table:"orders"},(p)=>{
        if(p.eventType==="INSERT") setActiveOrders(v=>up(v,p.new as Order));
        else if(p.eventType==="UPDATE") setActiveOrders(v=>up(v,p.new as Order));
        else if(p.eventType==="DELETE") setActiveOrders(v=>rm(v,(p.old as any).id));
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"leads"},(p)=>{
        if(p.eventType==="INSERT") setActiveLeads(v=>up(v,p.new as Lead));
        else if(p.eventType==="UPDATE") setActiveLeads(v=>up(v,p.new as Lead));
        else if(p.eventType==="DELETE") setActiveLeads(v=>rm(v,(p.old as any).id));
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"products"},(p)=>{
        if(p.eventType==="INSERT") setProducts(v=>up(v,p.new as Product));
        else if(p.eventType==="UPDATE") setProducts(v=>up(v,p.new as Product));
        else if(p.eventType==="DELETE") setProducts(v=>rm(v,(p.old as any).id));
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"admin_users"},(p)=>{
        if(p.eventType==="INSERT") setAdminUsers(v=>up(v,p.new as AdminUser));
        else if(p.eventType==="UPDATE") setAdminUsers(v=>up(v,p.new as AdminUser));
        else if(p.eventType==="DELETE") setAdminUsers(v=>rm(v,(p.old as any).id));
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"page_events"},(p)=>{
        setPageEvents(v=>{ const n=[p.new as PageEvent,...v]; return n.length>5000?n.slice(0,5000):n; });
      })
      .subscribe(s=>{ if(s==="SUBSCRIBED") fetchData().catch(()=>{}); });
    return ()=>{ supabase.removeChannel(ch); };
  }, []);

  const fetchData = async () => {
    try {
      const [pR,oR,lR,sR,eR,uR] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("orders").select("*"),
        supabase.from("leads").select("*"),
        supabase.from("site_config").select("*").eq("id","main").single(),
        supabase.from("page_events").select("*").order("created_at",{ascending:false}).limit(5000),
        supabase.from("admin_users").select("*"),
      ]);
      if(pR.data) setProducts(pR.data as Product[]);
      if(oR.data) setActiveOrders(oR.data as Order[]);
      if(lR.data) setActiveLeads(lR.data as Lead[]);
      if(sR.data) setSiteContent(p=>({...p,...(sR.data as any)}));
      if(eR.data) setPageEvents(eR.data as PageEvent[]);
      if(uR.data) setAdminUsers(uR.data as AdminUser[]);
    } catch(e){ console.error(e); }
  };

  // ── Printful sync ──
  const handleSyncPrintful = async () => {
    setIsSyncing(true);
    try {
      const {data:sd} = await supabase.auth.getSession();
      const token = sd.session?.access_token;
      const res = await fetch("/api/printful-sync",{method:"POST",headers:token?{Authorization:`Bearer ${token}`}:{}});
      const data = await res.json();
      if(!res.ok){toast.error(data.error||"Sync failed");return;}
      if(Array.isArray(data.errors)&&data.errors.length>0){toast.error(data.errors[0]);return;}
      toast.success(`Sync complete: ${data.synced}/${data.total} processed.`);
      await fetchData();
    } catch(e:any){ toast.error(`Sync error: ${e?.message}`); }
    finally { setIsSyncing(false); }
  };

  // ── Product CRUD ──
  const saveProduct = async () => {
    try {
      const imageUrls = productForm.image_url.split(",").map(u=>u.trim()).filter(u=>u);
      const payload = {
        title:productForm.title, slug:productForm.slug,
        price_cents:parseInt(productForm.price_cents)||0,
        image_urls:imageUrls, description:productForm.description,
        is_published:productForm.is_published, source_url:productForm.source_url,
        updated_at:new Date().toISOString(),
      };
      if(productForm.editingId){
        const {error}=await supabase.from("products").update(payload as any).eq("id",productForm.editingId);
        if(error) throw error; toast.success("Product updated.");
      } else {
        const {error}=await supabase.from("products").insert([payload] as any);
        if(error) throw error; toast.success("Product created.");
      }
      resetProductForm(); await fetchData();
    } catch(e:any){ toast.error(`Save failed: ${e.message}`); }
  };

  const togglePublished = async (id:string,cur:boolean) => {
    const {error}=await supabase.from("products").update({is_published:!cur}).eq("id",id);
    if(error) toast.error(error.message); else await fetchData();
  };
  const archiveProduct = async (id:string) => {
    const {error}=await supabase.from("products").delete().eq("id",id);
    if(error) toast.error(error.message); else { toast.success("Archived."); await fetchData(); }
  };
  const handleArchiveOrder = async (id:string) => {
    const {error}=await supabase.from("orders").delete().eq("id",id);
    if(error) toast.error(error.message); else { toast.success("Archived."); setSelectedRow(null); await fetchData(); }
  };

  const resetProductForm = () => {
    setProductForm({editingId:null,title:"",slug:"",price_cents:"",image_url:"",description:"",is_published:true,source_url:"",hasVariants:false,variantsText:"[]"});
    setProductFormOpen(false);
  };
  const startEditProduct = (p:Product) => {
    setProductForm({editingId:p.id,title:p.title,slug:p.slug,price_cents:String(p.price_cents),image_url:(p.image_urls||[]).join(", "),description:p.description||"",is_published:p.is_published,source_url:"",hasVariants:false,variantsText:"[]"});
    setProductFormOpen(true); setSection("products");
  };

  // ── Site config save ──
  const saveSiteConfig = async (updated:SiteContent) => {
    setSiteSaving(true);
    try {
      const payload:any = {id:"main",...updated,guarantee_days:String(updated.guarantee_days||"30"),updated_at:new Date().toISOString()};
      const {error}=await supabase.from("site_config").update(payload).eq("id","main");
      if(error) throw error; toast.success("Saved.");
    } catch(e:any){ toast.error(`Failed: ${e.message}`); }
    finally { setSiteSaving(false); }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href="/login"; };

  // ── Bulk ops ──
  const toggleSelectProduct = (id:string) => setSelectedIds(p=>{const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n;});
  const selectAllProducts = () => selectedIds.size===orderedProducts.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(orderedProducts.map(p=>p.id)));
  const bulkPublish = async (pub:boolean) => {
    setIsBulkActing(true);
    try {
      const ids=Array.from(selectedIds);
      const {error}=await supabase.from("products").update({is_published:pub}).in("id",ids);
      if(error) throw error;
      toast.success(`${ids.length} product(s) ${pub?"published":"unpublished"}.`);
      setSelectedIds(new Set()); setSelectMode(false); await fetchData();
    } catch(e:any){ toast.error(e.message); } finally { setIsBulkActing(false); }
  };
  const bulkDelete = async () => {
    if(!confirm(`Delete ${selectedIds.size} product(s)?`)) return;
    setIsBulkActing(true);
    try {
      const ids=Array.from(selectedIds);
      const {error}=await supabase.from("products").delete().in("id",ids);
      if(error) throw error;
      toast.success(`${ids.length} deleted.`); setSelectedIds(new Set()); setSelectMode(false); await fetchData();
    } catch(e:any){ toast.error(e.message); } finally { setIsBulkActing(false); }
  };

  // ── Drag reorder ──
  const handleDragStart = (id:string) => setDraggedId(id);
  const handleDragOver  = (e:React.DragEvent,id:string) => { e.preventDefault(); setDragOverId(id); };
  const handleDrop = async (targetId:string) => {
    if(!draggedId||draggedId===targetId){ setDraggedId(null); setDragOverId(null); return; }
    const reordered=[...orderedProducts];
    const fi=reordered.findIndex(p=>p.id===draggedId), ti=reordered.findIndex(p=>p.id===targetId);
    const [mv]=reordered.splice(fi,1); reordered.splice(ti,0,mv);
    const updated=reordered.map((p,i)=>({...p,display_order:i}));
    setOrderedProducts(updated); setDraggedId(null); setDragOverId(null);
    try {
      await Promise.all(updated.map(p=>supabase.from("products").update({display_order:p.display_order}).eq("id",p.id)));
      toast.success("Order saved.");
    } catch(e:any){ toast.error(e.message); }
  };

  // ── Admin users ──
  const handleAddAdminUser = async () => {
    if(!newUserEmail.trim()) return;
    setIsAddingUser(true);
    try {
      const {error}=await supabase.from("admin_users").insert([{email:newUserEmail.trim().toLowerCase(),role:newUserRole,created_at:new Date().toISOString()}]);
      if(error) throw error;
      toast.success(`Added ${newUserEmail} as ${newUserRole}.`); setNewUserEmail(""); setNewUserRole("viewer"); await fetchData();
    } catch(e:any){ toast.error(e.message); } finally { setIsAddingUser(false); }
  };
  const handleRemoveAdminUser = async (id:string) => {
    const {error}=await supabase.from("admin_users").delete().eq("id",id);
    if(error) toast.error(error.message); else { toast.success("Removed."); await fetchData(); }
  };
  const handleUpdateUserRole = async (id:string,role:"admin"|"manager"|"viewer") => {
    const {error}=await supabase.from("admin_users").update({role}).eq("id",id);
    if(error) toast.error(error.message); else { toast.success("Updated."); await fetchData(); }
  };

  const handleOpenJarvis = async () => {
    try { if(document.documentElement.requestFullscreen&&!document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch{}
    navigate({to:"/admin/jarvis"});
  };

  // ── Computed: Revenue ──
  const inRange = (d:Date,r:typeof revenueRange) => {
    const now=new Date();
    if(r==="day")   return d.toDateString()===now.toDateString();
    if(r==="week")  return (now.getTime()-d.getTime())<7*86400000;
    if(r==="month") return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    return true;
  };
  const inRangePrev = (d:Date,r:typeof revenueRange) => {
    const now=new Date();
    if(r==="day")  { const y=new Date(now); y.setDate(now.getDate()-1); return d.toDateString()===y.toDateString(); }
    if(r==="week") { const df=now.getTime()-d.getTime(); return df>=7*86400000&&df<14*86400000; }
    if(r==="month"){ const p=new Date(now); p.setMonth(now.getMonth()-1); return d.getMonth()===p.getMonth()&&d.getFullYear()===p.getFullYear(); }
    return false;
  };
  const paidOrders    = activeOrders.filter(o=>o.status==="paid");
  const pendingOrders = activeOrders.filter(o=>o.status==="pending");
  const failedOrders  = activeOrders.filter(o=>o.status==="failed");
  const curOrders = paidOrders.filter(o=>inRange(new Date(o.created_at),revenueRange));
  const prevOrders= paidOrders.filter(o=>inRangePrev(new Date(o.created_at),revenueRange));
  const filteredRevenue = curOrders.reduce((s,o)=>s+o.amount_cents,0);
  const prevRevenue     = prevOrders.reduce((s,o)=>s+o.amount_cents,0);
  const revenueDelta    = prevRevenue>0 ? Math.round(((filteredRevenue-prevRevenue)/prevRevenue)*100) : null;
  const avgTicket       = curOrders.length>0  ? filteredRevenue/curOrders.length  : 0;
  const prevAvgTicket   = prevOrders.length>0 ? prevRevenue/prevOrders.length : 0;
  const avgTicketDelta  = prevAvgTicket>0 ? Math.round(((avgTicket-prevAvgTicket)/prevAvgTicket)*100) : null;
  const ordersInPeriod  = curOrders.length;
  const prevOrdersCount = prevOrders.length;
  const ordersDelta     = prevOrdersCount>0 ? Math.round(((ordersInPeriod-prevOrdersCount)/prevOrdersCount)*100) : null;
  const convRate        = activeOrders.length>0 ? Math.round((paidOrders.length/activeOrders.length)*100) : 0;
  const fmt$ = (c:number) => `$${(c/100).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2})}`;
  const fmtDate = (d:string) => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});

  // ── Funnel ──
  const hasEvents = pageEvents.length>0;
  const fViews    = hasEvents ? pageEvents.filter(e=>e.event_type==="page_view").length : 0;
  const fClicks   = hasEvents ? pageEvents.filter(e=>e.event_type==="product_click").length : 0;
  const fCarts    = hasEvents ? pageEvents.filter(e=>["add_to_cart","add-to-cart","cart","addtocart"].includes(e.event_type?.toLowerCase()||"")).length : 0;
  const fCheckout = hasEvents ? pageEvents.filter(e=>e.event_type==="checkout_start").length : 0;
  const fPurchase = paidOrders.length;
  const fMax      = Math.max(fViews,fClicks,fCarts,fCheckout,fPurchase,1);

  // ── Sparkline (7 days) ──
  const sparkData = useMemo(() => {
    const days=[];
    for(let i=6;i>=0;i--){
      const d=new Date(); d.setDate(d.getDate()-i);
      const v=paidOrders.filter(o=>new Date(o.created_at).toDateString()===d.toDateString()).reduce((s,o)=>s+o.amount_cents,0);
      days.push(v);
    }
    return days;
  },[paidOrders]);

  // ── Top products ──
  const topProducts = useMemo(()=>{
    const map:Record<string,{title:string;revenue:number;units:number}> = {};
    paidOrders.forEach(o=>{
      const key=(o as any).product_id||"store";
      const prod=products.find(p=>p.id===key);
      const title=prod?.title||"All Products";
      if(!map[key]) map[key]={title,revenue:0,units:0};
      map[key].revenue+=o.amount_cents; map[key].units+=1;
    });
    return Object.values(map).sort((a,b)=>b.revenue-a.revenue).slice(0,5);
  },[paidOrders,products]);

  // ── Analytics ──
  const analyticsRangeDays=parseInt(analyticsRange);
  const analyticsEvents=useMemo(()=>{
    const cut=new Date(); cut.setDate(cut.getDate()-analyticsRangeDays);
    return pageEvents.filter(e=>new Date(e.created_at)>=cut);
  },[pageEvents,analyticsRangeDays]);
  const analyticsChartData=useMemo(()=>{
    const days=[];
    for(let i=analyticsRangeDays-1;i>=0;i--){
      const d=new Date(); d.setDate(d.getDate()-i);
      const lbl=d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
      const views=analyticsEvents.filter(e=>e.event_type==="page_view"&&new Date(e.created_at).toDateString()===d.toDateString()).length;
      days.push({label:lbl,views});
    }
    return days;
  },[analyticsEvents,analyticsRangeDays]);
  const chartMax=Math.max(...analyticsChartData.map(d=>d.views),1);
  const topReferrers=useMemo(()=>{
    const m:Record<string,number>={};
    analyticsEvents.filter(e=>e.referrer).forEach(e=>{m[e.referrer||"direct"]=(m[e.referrer||"direct"]||0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,5);
  },[analyticsEvents]);
  const topPaths=useMemo(()=>{
    const m:Record<string,number>={};
    analyticsEvents.filter(e=>e.event_type==="page_view").forEach(e=>{m[e.path]=(m[e.path]||0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8);
  },[analyticsEvents]);
  const productClickMap=useMemo(()=>{
    const m:Record<string,number>={};
    analyticsEvents.filter(e=>e.event_type==="product_click"&&e.product_id).forEach(e=>{m[e.product_id!]=(m[e.product_id!]||0)+1;});
    return m;
  },[analyticsEvents]);
  const uniqueSessions=useMemo(()=>new Set(analyticsEvents.filter(e=>e.session_id).map(e=>e.session_id)).size,[analyticsEvents]);
  const geoBreakdown=useMemo(()=>{
    const m:Record<string,number>={};
    analyticsEvents.filter(e=>e.country).forEach(e=>{m[e.country!]=(m[e.country!]||0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,6);
  },[analyticsEvents]);

  // ── Filtered tables ──
  const filteredOrders=activeOrders
    .filter(o=>orderStatusFilter==="all"||o.status===orderStatusFilter)
    .filter(o=>o.email.toLowerCase().includes(searchQuery.toLowerCase())||(o.name||"").toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredLeads=activeLeads.filter(l=>l.email.toLowerCase().includes(searchQuery.toLowerCase()));

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`adm-root ${isDark ? "" : "light"}`}>
      <style>{`html,body{margin:0;padding:0;}`}</style>
      <div className="adm-hexbg" />
      <div className="adm-scan" />
      <div className="adm-topline" />

      {/* ── NAV ── */}
      <nav className="adm-nav">
        <div className="adm-nav-brand">
          <Led color="g" />
          CTRL_CENTER
        </div>

        <div className="adm-nav-links" style={{ display: mobileMenuOpen ? "none" : undefined }}>
          {navSections.map(s => (
            <button key={s} onClick={()=>setSection(s)} className={`adm-nav-btn ${section===s?"active":""}`}>
              {s}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={handleOpenJarvis} className="adm-jarvis-btn">JARVIS →</button>
          <button onClick={()=>setMobileMenuOpen(!mobileMenuOpen)} style={{ background:"none", border:"none", color:"var(--c-text)", cursor:"pointer", display:"none" }} className="adm-mobile-ham">
            <Menu size={18} />
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="adm-mobile-menu">
          {navSections.map(s=>(
            <button key={s} onClick={()=>{setSection(s);setMobileMenuOpen(false);}} className={`adm-nav-btn ${section===s?"active":""}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      <TickerTape isDark={isDark} />

      <main className="adm-main">

        {/* ═══════════════════════════════════════════════════
            OVERVIEW
        ═══════════════════════════════════════════════════ */}
        {section === "overview" && (
          <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <div>
                <div className="adm-heading">Overview</div>
                <div className="adm-subheading">LIVE SYSTEM DIAGNOSTICS · REALTIME FEED</div>
              </div>
              <div className="adm-period-bar">
                {(["day","week","month","all"] as const).map(r=>(
                  <button key={r} onClick={()=>setRevenueRange(r)} className={`adm-period-btn ${revenueRange===r?"active":""}`}>{r}</button>
                ))}
              </div>
            </div>

            {/* REVENUE PANEL with radar + waveform + matrix */}
            <div className="adm-panel" style={{ display:"flex", gap:0 }}>
              <Brackets />
              <div className="adm-matrix-wrap" style={{ width:72 }}>
                <MatrixRain width={72} height={200} isDark={isDark} />
              </div>
              <div style={{ flex:1, padding:"20px 24px", display:"flex", flexDirection:"column", gap:14 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Led color="c" />
                  <span style={{ fontSize:9, letterSpacing:"0.2em", color:"var(--c-muted)", textTransform:"uppercase" }}>Revenue · {revenueRange}</span>
                </div>
                <div style={{ display:"flex", alignItems:"baseline", gap:12, flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"var(--font-title)", fontSize:40, fontWeight:900, color:"var(--c-cyan)", letterSpacing:"0.02em", textShadow:isDark?"0 0 24px var(--c-cyan)":"none" }}>
                    {fmt$(filteredRevenue)}
                  </span>
                  {revenueDelta !== null && (
                    <span style={{ fontSize:11, padding:"2px 10px", background:revenueDelta>0?"rgba(0,255,136,0.1)":"rgba(255,56,96,0.1)", color:revenueDelta>0?"var(--c-green)":"var(--c-red)", letterSpacing:"0.1em" }}>
                      {revenueDelta>0?<TrendingUp size={10} style={{display:"inline",verticalAlign:"middle",marginRight:4}}/>:<TrendingDown size={10} style={{display:"inline",verticalAlign:"middle",marginRight:4}}/>}
                      {revenueDelta>0?"+":""}{revenueDelta}% VS PRIOR
                    </span>
                  )}
                </div>
                <WaveformCanvas data={sparkData} color={isDark?"#00e5ff":"#0077aa"} height={52} />
              </div>
              <div style={{ padding:"20px 20px 20px 0", display:"flex", alignItems:"center" }}>
                <RadarDisplay isDark={isDark} />
              </div>
            </div>

            {/* STATS GRID */}
            <div className="adm-grid-5">
              <StatDelta label="Orders"     value={ordersInPeriod}     sub="paid this period"  delta={ordersDelta}     />
              <StatDelta label="Avg Ticket" value={fmt$(avgTicket)}    sub="per paid order"    delta={avgTicketDelta}  />
              <Stat      label="Conv Rate"  value={`${convRate}%`}     sub="checkout → paid"   led="a" />
              <Stat      label="Leads"      value={activeLeads.length} sub="total captured"    led="p" />
              <Stat      label="Add to Cart" value={fCarts>0?fCarts.toLocaleString():"—"} sub="cart events" led="c" />
            </div>

            {/* STATUS ROW */}
            <div className="adm-grid-4">
              {[
                {label:"Paid",      count:paidOrders.length,                    color:"var(--c-green)", led:"g" as const},
                {label:"Pending",   count:pendingOrders.length,                  color:"var(--c-amber)", led:"a" as const},
                {label:"Failed",    count:failedOrders.length,                   color:"var(--c-red)",   led:"r" as const},
                {label:"Published", count:products.filter(p=>p.is_published).length, color:"var(--c-cyan)",  led:"c" as const},
              ].map(item=>(
                <div key={item.label} className="adm-panel" style={{ padding:"16px 18px", position:"relative" }}>
                  <Brackets />
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:9, letterSpacing:"0.18em", color:"var(--c-muted)", textTransform:"uppercase" }}>{item.label}</span>
                    <Led color={item.led} />
                  </div>
                  <div style={{ fontFamily:"var(--font-title)", fontSize:28, fontWeight:700, color:item.color, textShadow:isDark?`0 0 16px ${item.color}`:"none" }}>
                    {item.count}
                  </div>
                </div>
              ))}
            </div>

            {/* TELEMETRY PIPELINE */}
            <div className="adm-panel">
              <Brackets />
              <div style={{ padding:"16px 20px 6px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <Led color="g" />
                  <span style={{ fontSize:9, letterSpacing:"0.2em", color:"var(--c-muted)", textTransform:"uppercase" }}>Real-Time Telemetry Pipeline</span>
                </div>
                {!hasEvents && (
                  <span className="adm-chip">TRACKER NOT INSTALLED</span>
                )}
              </div>
              <TelemetryPipeline views={fViews} clicks={fClicks} carts={fCarts} checkouts={fCheckout} purchases={fPurchase} isDark={isDark} />
              {hasEvents && fViews>0 && fPurchase>0 && (
                <div style={{ padding:"0 20px 12px", fontSize:9, color:"var(--c-muted)", letterSpacing:"0.12em", textAlign:"right" }}>
                  OVERALL: {((fPurchase/fViews)*100).toFixed(2)}% VISITOR → PURCHASE
                </div>
              )}
            </div>

            {/* FUNNEL + TOP PRODUCTS */}
            <div className="adm-grid-2">
              {/* Funnel */}
              <div className="adm-panel" style={{ padding:"20px" }}>
                <Brackets />
                <div style={{ fontSize:9, letterSpacing:"0.2em", color:"var(--c-muted)", marginBottom:16, textTransform:"uppercase" }}>Conversion Funnel</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[
                    {label:"Page Views",    val:hasEvents?fViews:null,    c:"var(--c-cyan)"},
                    {label:"Product Clicks",val:hasEvents?fClicks:null,   c:"var(--c-cyan)"},
                    {label:"Add to Cart",   val:hasEvents?fCarts:null,    c:"var(--c-amber)"},
                    {label:"Checkout",      val:hasEvents?fCheckout:null, c:"var(--c-amber)"},
                    {label:"Purchased",     val:fPurchase,                c:"var(--c-green)"},
                  ].map((step,i)=>(
                    <div key={step.label} style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:9, letterSpacing:"0.1em", color:"var(--c-muted)", width:110, flexShrink:0, textTransform:"uppercase" }}>{step.label}</span>
                      <div className="adm-funnel-bar-bg">
                        <div className="adm-funnel-bar-fill" style={{ width:`${((step.val??0)/fMax)*100}%`, background:step.c, opacity:1-i*0.12 }} />
                      </div>
                      <span style={{ fontSize:10, color:"var(--c-text)", width:42, textAlign:"right", fontFamily:"var(--font-title)", fontSize:11 }}>
                        {step.val!==null?step.val.toLocaleString():"—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Products */}
              {topProducts.length > 0 ? (
                <div className="adm-panel" style={{ padding:"20px" }}>
                  <Brackets />
                  <div style={{ fontSize:9, letterSpacing:"0.2em", color:"var(--c-muted)", marginBottom:16, textTransform:"uppercase" }}>Top Products · Revenue</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                    {topProducts.map((p,i)=>(
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid var(--c-border)" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:9, color:"var(--c-muted)", fontFamily:"var(--font-title)", minWidth:14 }}>0{i+1}</span>
                          <span style={{ fontSize:11, color:"var(--c-text)", letterSpacing:"0.06em", textTransform:"uppercase" }}>{p.title}</span>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:"var(--font-title)", fontSize:13, color:"var(--c-cyan)" }}>{fmt$(p.revenue)}</div>
                          <div style={{ fontSize:9, color:"var(--c-muted)" }}>{p.units} orders</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="adm-panel" style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span className="adm-empty">NO ORDERS YET</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            PRODUCTS
        ═══════════════════════════════════════════════════ */}
        {section === "products" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <div>
                <div className="adm-heading">Products</div>
                <div className="adm-subheading">CATALOG MANAGEMENT · {orderedProducts.length} ITEMS</div>
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <button onClick={()=>{setSelectMode(!selectMode);setSelectedIds(new Set());}} className={`adm-btn ${selectMode?"adm-btn-active":""}`}>
                  {selectMode?"CANCEL":"SELECT"}
                </button>
                <button onClick={handleSyncPrintful} disabled={isSyncing} className="adm-btn" style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <RefreshCw size={12} className={isSyncing?"animate-spin":""} />
                  {isSyncing?"SYNCING":"SYNC PRINTFUL"}
                </button>
                <button onClick={()=>setProductFormOpen(!productFormOpen)} className="adm-btn adm-btn-primary">
                  {productFormOpen?"CLOSE":"+ NEW PRODUCT"}
                </button>
              </div>
            </div>

            {/* bulk toolbar */}
            {selectMode && selectedIds.size > 0 && (
              <div className="adm-select-bar">
                <span style={{ fontSize:9, letterSpacing:"0.15em", color:"var(--c-cyan)" }}>{selectedIds.size} SELECTED</span>
                <div style={{ display:"flex", gap:8, marginLeft:"auto", flexWrap:"wrap" }}>
                  <button onClick={selectAllProducts} className="adm-btn" style={{ padding:"5px 12px", fontSize:9 }}>
                    {selectedIds.size===orderedProducts.length?"DESELECT ALL":"SELECT ALL"}
                  </button>
                  <button onClick={()=>bulkPublish(true)} disabled={isBulkActing} className="adm-btn" style={{ padding:"5px 12px", fontSize:9, color:"var(--c-green)", borderColor:"var(--c-green)" }}>
                    <Eye size={10} style={{marginRight:4,display:"inline",verticalAlign:"middle"}}/>PUBLISH
                  </button>
                  <button onClick={()=>bulkPublish(false)} disabled={isBulkActing} className="adm-btn" style={{ padding:"5px 12px", fontSize:9 }}>
                    <EyeOff size={10} style={{marginRight:4,display:"inline",verticalAlign:"middle"}}/>UNPUBLISH
                  </button>
                  <button onClick={bulkDelete} disabled={isBulkActing} className="adm-btn adm-btn-danger" style={{ padding:"5px 12px", fontSize:9 }}>
                    <Trash2 size={10} style={{marginRight:4,display:"inline",verticalAlign:"middle"}}/>DELETE
                  </button>
                </div>
              </div>
            )}

            {/* product form */}
            {productFormOpen && (
              <div className="adm-panel" style={{ padding:24 }}>
                <Brackets />
                <div style={{ fontSize:9, letterSpacing:"0.2em", color:"var(--c-cyan)", marginBottom:20, textTransform:"uppercase" }}>
                  {productForm.editingId?"// EDIT PRODUCT":"// NEW PRODUCT"}
                </div>
                <div className="adm-grid-2" style={{ marginBottom:16 }}>
                  <InputField label="Title"      value={productForm.title}      onChange={v=>setProductForm(f=>({...f,title:v}))} />
                  <InputField label="Price (¢)"  value={productForm.price_cents} onChange={v=>setProductForm(f=>({...f,price_cents:v}))} type="number" />
                  <InputField label="Slug"       value={productForm.slug}       onChange={v=>setProductForm(f=>({...f,slug:v}))} />
                  <InputField label="Source URL" value={productForm.source_url} onChange={v=>setProductForm(f=>({...f,source_url:v}))} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <InputField label="Image URL(s)" value={productForm.image_url} onChange={v=>setProductForm(f=>({...f,image_url:v}))} />
                </div>
                <div className="adm-input-wrap" style={{ marginBottom:20 }}>
                  <label className="adm-input-label">Description</label>
                  <textarea value={productForm.description} onChange={e=>setProductForm(f=>({...f,description:e.target.value}))} className="adm-textarea" rows={3} />
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <button onClick={()=>setProductForm(f=>({...f,is_published:!f.is_published}))} className="adm-btn" style={{ fontSize:9, padding:"5px 14px", color:productForm.is_published?"var(--c-green)":"var(--c-red)", borderColor:productForm.is_published?"var(--c-green)":"var(--c-red)" }}>
                    {productForm.is_published?"● PUBLISHED":"○ DRAFT"}
                  </button>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={resetProductForm} className="adm-btn" style={{ fontSize:9, padding:"5px 14px" }}>CANCEL</button>
                    <button onClick={saveProduct} className="adm-btn adm-btn-primary" style={{ fontSize:9, padding:"7px 24px" }}>
                      {productForm.editingId?"SAVE CHANGES":"CREATE"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!selectMode && (
              <div style={{ fontSize:9, letterSpacing:"0.15em", color:"var(--c-muted)" }}>
                ▸ DRAG TO REORDER  ·  SELECT FOR BULK OPS
              </div>
            )}

            {/* product grid */}
            <div className="adm-grid-prod">
              {orderedProducts.map(p=>{
                const isPF=!!p.printful_id;
                const isSel=selectedIds.has(p.id);
                const isDrg=draggedId===p.id;
                const isDrO=dragOverId===p.id;
                return (
                  <div
                    key={p.id}
                    className={`adm-product-card ${isSel?"selected":""} ${isDrO?"drag-over":""}`}
                    style={{ opacity:isDrg?0.35:1, transform:isDrg?"scale(0.93)":"" }}
                    draggable={!selectMode}
                    onDragStart={()=>handleDragStart(p.id)}
                    onDragOver={e=>handleDragOver(e,p.id)}
                    onDrop={()=>handleDrop(p.id)}
                    onDragEnd={()=>{setDraggedId(null);setDragOverId(null);}}
                    onClick={()=>selectMode&&toggleSelectProduct(p.id)}
                  >
                    {selectMode && (
                      <div style={{ position:"absolute", top:8, left:8, zIndex:10 }}>
                        {isSel?<CheckSquare size={13} color="var(--c-cyan)"/>:<Square size={13} color="var(--c-muted)"/>}
                      </div>
                    )}
                    {!selectMode && (
                      <div style={{ position:"absolute", top:8, left:8, zIndex:10, opacity:0, transition:"opacity 0.2s" }} className="adm-grip">
                        <GripVertical size={11} color="var(--c-muted)"/>
                      </div>
                    )}
                    {isPF && (
                      <div style={{ position:"absolute", top:8, right:8, zIndex:10, display:"flex", alignItems:"center", gap:3, padding:"2px 6px", background:"rgba(0,229,255,0.1)", border:"1px solid var(--c-border2)", fontSize:7, letterSpacing:"0.15em", color:"var(--c-cyan)" }}>
                        <Lock size={7}/>PF
                      </div>
                    )}
                    <div style={{ aspectRatio:"3/4", background:"var(--c-bg)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", padding:12 }}>
                      {p.image_urls?.length>1 ? (
                        <img src={p.image_urls[1]} alt={p.title} style={{ maxHeight:"100%", maxWidth:"100%", objectFit:"contain", transition:"transform 0.4s", display:"block" }} />
                      ) : p.image_urls?.[0] ? (
                        <img src={p.image_urls[0]} alt={p.title} style={{ maxHeight:"100%", maxWidth:"100%", objectFit:"contain", transition:"transform 0.4s", display:"block" }} />
                      ) : (
                        <span style={{ fontSize:8, letterSpacing:"0.2em", color:"var(--c-muted)" }}>NO_IMAGE</span>
                      )}
                    </div>
                    <div style={{ padding:"10px 12px", borderTop:"1px solid var(--c-border)" }}>
                      <div style={{ fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--c-text)", marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</div>
                      <div style={{ fontFamily:"var(--font-title)", fontSize:11, color:"var(--c-cyan)" }}>${(p.price_cents/100).toFixed(2)}</div>
                      {!selectMode && (
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:10, marginTop:8 }}>
                          <button onClick={e=>{e.stopPropagation();togglePublished(p.id,p.is_published);}} style={{ width:7, height:7, borderRadius:"50%", background:p.is_published?"var(--c-green)":"var(--c-red)", border:"none", cursor:"pointer", padding:0, boxShadow:isDark?`0 0 6px ${p.is_published?"var(--c-green)":"var(--c-red)"}`:""}} />
                          {isPF ? (
                            <span style={{ color:"var(--c-border2)", cursor:"not-allowed" }} title="Sync from Printful"><Edit3 size={11}/></span>
                          ) : (
                            <button onClick={e=>{e.stopPropagation();startEditProduct(p);}} style={{ background:"none", border:"none", color:"var(--c-muted)", cursor:"pointer", padding:0, transition:"color 0.2s" }}><Edit3 size={11}/></button>
                          )}
                          <button onClick={e=>{e.stopPropagation();archiveProduct(p.id);}} style={{ background:"none", border:"none", color:"var(--c-muted)", cursor:"pointer", padding:0, transition:"color 0.2s" }}><Archive size={11}/></button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            ORDERS
        ═══════════════════════════════════════════════════ */}
        {section === "orders" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <div>
                <div className="adm-heading">Orders</div>
                <div className="adm-subheading">TRANSACTION LEDGER · {activeOrders.length} RECORDS</div>
              </div>
              <input type="text" placeholder="SEARCH..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="adm-search" />
            </div>

            <div className="adm-tabbar">
              {([{key:"all",label:"All",count:activeOrders.length},{key:"paid",label:"Paid",count:paidOrders.length},{key:"pending",label:"Pending",count:pendingOrders.length},{key:"failed",label:"Failed",count:failedOrders.length}] as const).map(tab=>(
                <button key={tab.key} onClick={()=>setOrderStatusFilter(tab.key)} className={`adm-tab ${orderStatusFilter===tab.key?"active":""}`}>
                  {tab.label}<span className="adm-tab-count">{tab.count}</span>
                </button>
              ))}
            </div>

            <div className="adm-panel" style={{ overflow:"auto" }}>
              <Brackets />
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Email</th><th>Name</th><th>Amount</th><th>Status</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(o=>(
                    <tr key={o.id} onClick={()=>setSelectedRow({...o,_type:"order"})}>
                      <td style={{ fontFamily:"var(--font-hud)", letterSpacing:"0.04em" }}>{o.email}</td>
                      <td style={{ color:"var(--c-muted)", fontSize:10 }}>{o.name||"—"}</td>
                      <td style={{ fontFamily:"var(--font-title)", color:"var(--c-cyan)", fontSize:12 }}>{fmt$(o.amount_cents)}</td>
                      <td>
                        <span className={`adm-badge ${o.status==="paid"?"adm-badge-g":o.status==="pending"?"adm-badge-a":"adm-badge-r"}`}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ color:"var(--c-muted)", fontSize:10 }}>{fmtDate(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredOrders.length===0 && <div className="adm-empty">NO_RECORDS_FOUND</div>}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            LEADS
        ═══════════════════════════════════════════════════ */}
        {section === "leads" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <div>
                <div className="adm-heading">Leads</div>
                <div className="adm-subheading">CAPTURE REGISTER · {activeLeads.length} CONTACTS</div>
              </div>
              <input type="text" placeholder="SEARCH..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="adm-search" />
            </div>
            <div className="adm-panel" style={{ overflow:"auto" }}>
              <Brackets />
              <table className="adm-table">
                <thead><tr><th>Email</th><th>Captured</th></tr></thead>
                <tbody>
                  {filteredLeads.map(l=>(
                    <tr key={l.id}>
                      <td style={{ fontFamily:"var(--font-hud)" }}>{l.email}</td>
                      <td style={{ color:"var(--c-muted)", fontSize:10 }}>{fmtDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredLeads.length===0 && <div className="adm-empty">NO_LEADS_YET</div>}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            ANALYTICS
        ═══════════════════════════════════════════════════ */}
        {section === "analytics" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <div>
                <div className="adm-heading">Analytics</div>
                <div className="adm-subheading">TELEMETRY CORE · SESSION TRACKING</div>
              </div>
              <div className="adm-period-bar">
                {(["7","14","30"] as const).map(r=>(
                  <button key={r} onClick={()=>setAnalyticsRange(r)} className={`adm-period-btn ${analyticsRange===r?"active":""}`}>{r}D</button>
                ))}
              </div>
            </div>

            {!hasEvents && (
              <div className="adm-panel" style={{ padding:24 }}>
                <Brackets />
                <div style={{ fontSize:9, color:"var(--c-amber)", letterSpacing:"0.2em", marginBottom:12, textTransform:"uppercase" }}>
                  ⚠ TRACKER OFFLINE — INSTALL HOOK TO ENABLE
                </div>
                <pre className="adm-code-block">{`export function trackEvent(type, data = {}) {
  supabase.from('page_events').insert([{
    event_type: type,
    path: window.location.pathname,
    session_id: sessionStorage.getItem('sid') || (() => {
      const id = crypto.randomUUID();
      sessionStorage.setItem('sid', id);
      return id;
    })(),
    referrer: document.referrer || null,
    ...data
  }]);
}`}</pre>
              </div>
            )}

            <div className="adm-grid-5">
              <Stat label="Page Views"     value={analyticsEvents.filter(e=>e.event_type==="page_view").length.toLocaleString()}        sub={`last ${analyticsRange}d`} led="c" />
              <Stat label="Sessions"       value={uniqueSessions.toLocaleString()}                                                       sub="unique visitors"           led="p" />
              <Stat label="Product Clicks" value={analyticsEvents.filter(e=>e.event_type==="product_click").length.toLocaleString()}     sub="click-throughs"            led="c" />
              <Stat label="Add to Cart"    value={analyticsEvents.filter(e=>["add_to_cart","cart"].includes(e.event_type||"")).length.toLocaleString()} sub="cart actions" led="a" />
              <Stat label="Checkout"       value={analyticsEvents.filter(e=>e.event_type==="checkout_start").length.toLocaleString()}    sub="checkout starts"           led="a" />
            </div>

            {/* Bar chart */}
            <div className="adm-panel" style={{ padding:"20px 24px" }}>
              <Brackets />
              <div style={{ fontSize:9, letterSpacing:"0.2em", color:"var(--c-muted)", marginBottom:16, textTransform:"uppercase" }}>Daily Page Views — Last {analyticsRange} Days</div>
              <div className="adm-bar-chart">
                {analyticsChartData.map((d,i)=>(
                  <div key={i} className="adm-bar-col">
                    <div className="adm-bar" style={{
                      height:`${(d.views/chartMax)*100}%`,
                      minHeight: d.views>0?3:1,
                      background:isDark?"rgba(0,229,255,0.18)":"rgba(0,119,170,0.15)",
                      borderTopColor:isDark?"var(--c-cyan)":"var(--c-cyan2)",
                    }} />
                    {i%Math.ceil(analyticsRangeDays/7)===0 && (
                      <span className="adm-bar-lbl">{d.label.split(" ")[1]||""}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="adm-grid-2">
              <div className="adm-panel" style={{ padding:"20px" }}>
                <Brackets />
                <div style={{ fontSize:9, letterSpacing:"0.2em", color:"var(--c-muted)", marginBottom:14, textTransform:"uppercase" }}>Top Referrers</div>
                {topReferrers.length===0 ? <div className="adm-empty">NO_DATA</div> : (
                  <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                    {topReferrers.map(([ref,cnt])=>(
                      <div key={ref} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--c-border)", fontSize:10, letterSpacing:"0.06em" }}>
                        <span style={{ color:"var(--c-text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"75%" }}>{ref||"direct"}</span>
                        <span style={{ fontFamily:"var(--font-title)", color:"var(--c-cyan)", fontSize:11 }}>{cnt}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="adm-panel" style={{ padding:"20px" }}>
                <Brackets />
                <div style={{ fontSize:9, letterSpacing:"0.2em", color:"var(--c-muted)", marginBottom:14, textTransform:"uppercase" }}>Top Pages</div>
                {topPaths.length===0 ? <div className="adm-empty">NO_DATA</div> : (
                  <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                    {topPaths.map(([path,cnt])=>(
                      <div key={path} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid var(--c-border)", fontSize:10 }}>
                        <span style={{ color:"var(--c-muted)", fontFamily:"var(--font-hud)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"75%" }}>{path}</span>
                        <span style={{ fontFamily:"var(--font-title)", color:"var(--c-cyan)", fontSize:11 }}>{cnt}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {Object.keys(productClickMap).length>0 && (
              <div className="adm-panel" style={{ overflow:"auto" }}>
                <Brackets />
                <table className="adm-table">
                  <thead><tr><th>Product</th><th style={{textAlign:"right"}}>Clicks</th></tr></thead>
                  <tbody>
                    {Object.entries(productClickMap).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([pid,clicks])=>{
                      const prod=products.find(p=>p.id===pid);
                      return (
                        <tr key={pid}>
                          <td style={{ textTransform:"uppercase", letterSpacing:"0.06em" }}>{prod?.title||pid}</td>
                          <td style={{ textAlign:"right", fontFamily:"var(--font-title)", color:"var(--c-cyan)" }}>{clicks}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {geoBreakdown.length>0 && (
              <div>
                <div style={{ fontSize:9, letterSpacing:"0.2em", color:"var(--c-muted)", marginBottom:12, textTransform:"uppercase" }}>Geographic Breakdown</div>
                <div className="adm-grid-4">
                  {geoBreakdown.map(([country,cnt])=>(
                    <div key={country} className="adm-panel" style={{ padding:"14px 16px" }}>
                      <Brackets />
                      <div style={{ fontSize:9, letterSpacing:"0.15em", color:"var(--c-muted)", textTransform:"uppercase", marginBottom:4 }}>{country}</div>
                      <div style={{ fontFamily:"var(--font-title)", fontSize:20, color:"var(--c-text)" }}>{cnt}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            SETTINGS
        ═══════════════════════════════════════════════════ */}
        {section === "settings" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20, maxWidth:680 }}>
            <div>
              <div className="adm-heading">Settings</div>
              <div className="adm-subheading">SYSTEM CONFIGURATION · ROOT ACCESS</div>
            </div>

            {/* Theme */}
            <div className="adm-panel" style={{ padding:24 }}>
              <Brackets />
              <div style={{ fontSize:9, letterSpacing:"0.2em", color:"var(--c-muted)", marginBottom:16, textTransform:"uppercase" }}>// Display Mode</div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase" }}>Interface Theme</span>
                <div style={{ display:"flex", border:"1px solid var(--c-border2)", overflow:"hidden" }}>
                  <button onClick={()=>{setIsDark(false);localStorage.setItem("theme","light");document.documentElement.classList.remove("dark");saveSiteConfig({...siteContent,theme:"light"});}}
                    className="adm-btn" style={{ padding:"7px 18px", fontSize:9, borderRadius:0, border:"none", background:!isDark?"var(--c-cyan)":"transparent", color:!isDark?"#04070d":"var(--c-muted)" }}>
                    LIGHT
                  </button>
                  <button onClick={()=>{setIsDark(true);document.documentElement.classList.add("dark");localStorage.setItem("theme","dark");saveSiteConfig({...siteContent,theme:"dark"});}}
                    className="adm-btn" style={{ padding:"7px 18px", fontSize:9, borderRadius:0, border:"none", background:isDark?"var(--c-cyan)":"transparent", color:isDark?"#04070d":"var(--c-muted)" }}>
                    DARK
                  </button>
                </div>
              </div>
            </div>

            {/* Team */}
            <div className="adm-panel" style={{ padding:24 }}>
              <Brackets />
              <div style={{ fontSize:9, letterSpacing:"0.2em", color:"var(--c-muted)", marginBottom:16, textTransform:"uppercase" }}>// Team Access</div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
                <input type="email" placeholder="EMAIL ADDRESS" value={newUserEmail} onChange={e=>setNewUserEmail(e.target.value)} className="adm-input" style={{ flex:1, minWidth:180 }} />
                <select value={newUserRole} onChange={e=>setNewUserRole(e.target.value as any)}
                  style={{ background:"transparent", border:"none", borderBottom:"1px solid var(--c-border2)", color:"var(--c-text)", fontFamily:"var(--font-hud)", fontSize:10, padding:"8px 4px", outline:"none", letterSpacing:"0.1em" }}>
                  <option value="viewer" style={{background:"var(--c-panel)"}}>VIEWER</option>
                  <option value="manager" style={{background:"var(--c-panel)"}}>MANAGER</option>
                  <option value="admin" style={{background:"var(--c-panel)"}}>ADMIN</option>
                </select>
                <button onClick={handleAddAdminUser} disabled={isAddingUser||!newUserEmail.trim()} className="adm-btn adm-btn-primary" style={{ fontSize:9, padding:"5px 16px", opacity:!newUserEmail.trim()?0.4:1 }}>
                  {isAddingUser?"ADDING...":"ADD"}
                </button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
                {[{role:"viewer",desc:"Read-only"},{role:"manager",desc:"Edit products & orders"},{role:"admin",desc:"Full access"}].map(r=>(
                  <div key={r.role} style={{ padding:"8px 10px", border:"1px solid var(--c-border)", fontSize:9, letterSpacing:"0.08em" }}>
                    <div style={{ color:"var(--c-cyan)", textTransform:"uppercase", marginBottom:3 }}>{r.role}</div>
                    <div style={{ color:"var(--c-muted)" }}>{r.desc}</div>
                  </div>
                ))}
              </div>
              {adminUsers.length>0 ? (
                <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                  {adminUsers.map(u=>(
                    <div key={u.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid var(--c-border)" }}>
                      <span style={{ flex:1, fontSize:10, fontFamily:"var(--font-hud)", overflow:"hidden", textOverflow:"ellipsis" }}>{u.email}</span>
                      <select value={u.role} onChange={e=>handleUpdateUserRole(u.id,e.target.value as any)}
                        style={{ background:"transparent", border:"1px solid var(--c-border2)", color:"var(--c-text)", fontFamily:"var(--font-hud)", fontSize:9, padding:"3px 6px", outline:"none", letterSpacing:"0.1em" }}>
                        <option value="viewer" style={{background:"var(--c-panel)"}}>VIEWER</option>
                        <option value="manager" style={{background:"var(--c-panel)"}}>MANAGER</option>
                        <option value="admin" style={{background:"var(--c-panel)"}}>ADMIN</option>
                      </select>
                      <button onClick={()=>handleRemoveAdminUser(u.id)} style={{ background:"none", border:"none", color:"var(--c-muted)", cursor:"pointer", padding:0, transition:"color 0.2s" }}><X size={12}/></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize:9, color:"var(--c-muted)", letterSpacing:"0.15em" }}>NO TEAM MEMBERS YET</div>
              )}
            </div>

            {/* Account */}
            <div className="adm-panel" style={{ padding:24 }}>
              <Brackets />
              <div style={{ fontSize:9, letterSpacing:"0.2em", color:"var(--c-muted)", marginBottom:16, textTransform:"uppercase" }}>// Account</div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:9, color:"var(--c-muted)", marginBottom:4, letterSpacing:"0.1em" }}>AUTHENTICATED AS</div>
                <div style={{ fontFamily:"var(--font-hud)", color:"var(--c-cyan)", fontSize:12 }}>{userEmail||"..."}</div>
              </div>
              <button onClick={handleSignOut} className="adm-btn adm-btn-danger" style={{ width:"100%", padding:"10px", textAlign:"center" }}>
                ⏻  TERMINATE SESSION
              </button>
            </div>
          </div>
        )}

      </main>

      {/* ── ORDER DETAIL MODAL ── */}
      {selectedRow && (
        <div className="adm-modal-backdrop" onClick={e=>{ if(e.target===e.currentTarget) setSelectedRow(null); }}>
          <div className="adm-modal">
            <div style={{ padding:"20px 24px", borderBottom:"1px solid var(--c-border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontFamily:"var(--font-title)", fontSize:11, letterSpacing:"0.2em", color:"var(--c-cyan)", textTransform:"uppercase" }}>Record Detail</span>
              <button onClick={()=>setSelectedRow(null)} style={{ background:"none", border:"none", color:"var(--c-muted)", cursor:"pointer", padding:0 }}><X size={16}/></button>
            </div>
            <div style={{ padding:"20px 24px" }}>
              {Object.entries(selectedRow).map(([k,v])=> k!=="type" && k!=="\_type" && (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", gap:16, padding:"8px 0", borderBottom:"1px solid var(--c-border)" }}>
                  <span style={{ fontSize:9, color:"var(--c-muted)", letterSpacing:"0.15em", textTransform:"uppercase", flexShrink:0 }}>{k}</span>
                  <span style={{ fontSize:10, fontFamily:"var(--font-hud)", textAlign:"right", wordBreak:"break-all" }}>{String(v)}</span>
                </div>
              ))}
            </div>
            {selectedRow._type === "order" && (
              <div style={{ padding:"16px 24px", borderTop:"1px solid var(--c-border)" }}>
                <button onClick={()=>handleArchiveOrder(selectedRow.id)} className="adm-btn adm-btn-danger" style={{ width:"100%", padding:"10px" }}>
                  ARCHIVE ORDER
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
