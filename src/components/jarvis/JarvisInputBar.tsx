// ─────────────────────────────────────────────────────────────
//  J.A.R.V.I.S — Luveni GM  |  components/jarvis/JarvisInputBar.tsx
//
//  Always-visible, theme-aware command bar. Identical on mobile and
//  desktop. Left: "+" attach (photos/files). Centre: text input.
//  Right: mute/voice toggle + send. Attachments render as removable
//  chips above the bar.
//
//  Phase 1: attachments are captured + surfaced through onSubmit but
//  not yet read by the brain (text-only). The seam is intentional so
//  Phase 1.5 can drop in real vision without touching this component.
// ─────────────────────────────────────────────────────────────

import { useRef, type KeyboardEvent } from 'react';
import { Plus, Mic, MicOff, ArrowUp, X, FileText } from 'lucide-react';

export interface Attachment {
  id:   string;
  file: File;
  url:  string;        // object URL (revoked on remove)
  name: string;
  kind: 'image' | 'file';
}

interface JarvisInputBarProps {
  value:       string;
  onChange:    (v: string) => void;
  onSubmit:    () => void;
  attachments: Attachment[];
  onAttach:    (files: FileList | null) => void;
  onRemove:    (id: string) => void;
  muted:       boolean;          // true = text-only (mic off, no spoken replies)
  onToggleMute:() => void;
  disabled?:   boolean;          // true while Astra is thinking/speaking
  onFocus?:    () => void;
}

export default function JarvisInputBar({
  value, onChange, onSubmit, attachments, onAttach, onRemove,
  muted, onToggleMute, disabled, onFocus,
}: JarvisInputBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef   = useRef<HTMLTextAreaElement>(null);

  const autosize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
      requestAnimationFrame(autosize);
    }
  };

  const canSend = !disabled && (value.trim().length > 0 || attachments.length > 0);

  return (
    <div style={S.wrap}>
      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div style={S.chips}>
          {attachments.map((a) => (
            <div key={a.id} style={S.chip}>
              {a.kind === 'image'
                ? <img src={a.url} alt={a.name} style={S.thumb} />
                : <span style={S.fileIcon}><FileText size={16} /></span>}
              <span style={S.chipName}>{a.name}</span>
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => onRemove(a.id)}
                style={S.chipX}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* The bar */}
      <div style={S.bar}>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx"
          style={{ display: 'none' }}
          onChange={(e) => { onAttach(e.target.files); e.target.value = ''; }}
        />

        <button
          type="button"
          aria-label="Attach photo or file"
          onClick={() => fileRef.current?.click()}
          style={S.iconBtn}
        >
          <Plus size={20} />
        </button>

        <textarea
          ref={taRef}
          value={value}
          rows={1}
          placeholder={muted ? 'Type your command, sir…' : 'Speak, or type your command, sir…'}
          onFocus={onFocus}
          onChange={(e) => { onChange(e.target.value); autosize(); }}
          onKeyDown={handleKey}
          style={S.input}
        />

        <button
          type="button"
          aria-label={muted ? 'Enable voice' : 'Mute (text only)'}
          title={muted ? 'Voice off — text only' : 'Voice on'}
          onClick={onToggleMute}
          style={{ ...S.iconBtn, ...(muted ? S.iconMuted : S.iconActive) }}
        >
          {muted ? <MicOff size={19} /> : <Mic size={19} />}
        </button>

        <button
          type="button"
          aria-label="Send"
          disabled={!canSend}
          onClick={onSubmit}
          style={{ ...S.sendBtn, opacity: canSend ? 1 : 0.35, cursor: canSend ? 'pointer' : 'default' }}
        >
          <ArrowUp size={20} />
        </button>
      </div>
    </div>
  );
}

// Theme-aware styling via the global CSS variables (--background / --foreground
// / --border / --muted / --muted-foreground). Works in both light and dark.
const S: Record<string, React.CSSProperties> = {
  wrap: {
    width: '100%',
    maxWidth: 720,
    margin: '0 auto',
    padding: '0 16px',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    boxSizing: 'border-box',
    zIndex: 20,
  },
  chips: {
    display: 'flex', flexWrap: 'wrap', gap: 8,
    marginBottom: 10, justifyContent: 'flex-start',
  },
  chip: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px 6px 6px',
    borderRadius: 12,
    background: 'var(--muted)',
    border: '1px solid var(--border)',
    maxWidth: 220,
  },
  thumb: { width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
  fileIcon: {
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--background)', color: 'var(--muted-foreground)',
  },
  chipName: {
    fontSize: 12, color: 'var(--foreground)', whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'none',
  },
  chipX: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
    background: 'transparent', border: 'none', color: 'var(--muted-foreground)',
  },
  bar: {
    display: 'flex', alignItems: 'flex-end', gap: 8,
    padding: 8,
    borderRadius: 22,
    background: 'var(--background)',
    border: '1px solid var(--border)',
    boxShadow: '0 8px 40px rgba(var(--shadow-rgb), 0.18)',
  },
  input: {
    flex: '1 1 auto',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    resize: 'none',
    color: 'var(--foreground)',
    fontSize: 15,
    lineHeight: 1.45,
    fontFamily: 'inherit',
    textTransform: 'none',
    padding: '9px 4px',
    maxHeight: 140,
    overflowY: 'auto',
  },
  iconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 40, height: 40, borderRadius: 14, flexShrink: 0,
    background: 'transparent', border: 'none',
    color: 'var(--muted-foreground)',
    transition: 'color 0.2s ease, background 0.2s ease',
  },
  iconActive: { color: 'var(--foreground)', background: 'var(--muted)' },
  iconMuted:  { color: 'var(--muted-foreground)' },
  sendBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 40, height: 40, borderRadius: 14, flexShrink: 0,
    background: 'var(--primary)', border: 'none',
    color: 'var(--background)',
    transition: 'opacity 0.2s ease',
  },
};
