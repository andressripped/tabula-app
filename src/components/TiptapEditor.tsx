import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table';
import { TableHeader } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { Image as ImageExt } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';
import { createLowlight, common } from 'lowlight';
import type { Page, Block } from '../App';
import { generateFromPrompt } from '../services/aiGenerator';
import './TiptapEditor.css';

const lowlight = createLowlight(common);

// ─── Migration: old Block[] → HTML for Tiptap ───────────────
function escH(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function markdownTableToHTML(md: string): string {
  const lines = md.trim().split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 2) return `<p>${escH(md)}</p>`;
  const parseRow = (l: string) =>
    l.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
  const headers = parseRow(lines[0]);
  const rows = lines.slice(2).map(parseRow);
  let html = '<table><thead><tr>' + headers.map(h => `<th>${escH(h)}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach(row => {
    html += '<tr>' + row.map(c => `<td>${escH(c)}</td>`).join('') + '</tr>';
  });
  return html + '</tbody></table>';
}

export function migrateBlocksToHTML(blocks: Block[]): string {
  if (!blocks || blocks.length === 0) return '';
  let html = '';
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.type === 'list') {
      let items = '';
      while (i < blocks.length && blocks[i].type === 'list') {
        items += `<li><p>${escH(blocks[i].content)}</p></li>`;
        i++;
      }
      html += `<ul>${items}</ul>`;
      continue;
    }
    if (block.type === 'todo') {
      let items = '';
      while (i < blocks.length && blocks[i].type === 'todo') {
        const checked = blocks[i].checked ? 'true' : 'false';
        items += `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox" ${blocks[i].checked ? 'checked' : ''}><span></span></label><div><p>${escH(blocks[i].content)}</p></div></li>`;
        i++;
      }
      html += `<ul data-type="taskList">${items}</ul>`;
      continue;
    }
    switch (block.type) {
      case 'h1': html += `<h1>${escH(block.content)}</h1>`; break;
      case 'h2': html += `<h2>${escH(block.content)}</h2>`; break;
      case 'h3': html += `<h3>${escH(block.content)}</h3>`; break;
      case 'p': html += `<p>${escH(block.content) || '<br>'}</p>`; break;
      case 'quote': html += `<blockquote><p>${escH(block.content)}</p></blockquote>`; break;
      case 'callout': html += `<blockquote><p>💡 ${escH(block.content)}</p></blockquote>`; break;
      case 'code':
        html += `<pre><code class="language-${block.language || 'javascript'}">${escH(block.content)}</code></pre>`;
        break;
      case 'divider': html += `<hr>`; break;
      case 'image': if (block.imageData) html += `<img src="${block.imageData}">`; break;
      case 'table': html += markdownTableToHTML(block.content); break;
      default: break; // skip 'ai' blocks
    }
    i++;
  }
  return html || '<p></p>';
}

// ─── Tiptap JSON → Markdown (for export) ────────────────────
function nodeToMd(node: Record<string, unknown>): string {
  if (!node) return '';
  const content = (node.content as Record<string, unknown>[] | undefined) || [];
  switch (node.type as string) {
    case 'doc': return content.map(nodeToMd).join('\n\n');
    case 'heading': {
      const level = (node.attrs as Record<string, number>)?.level ?? 1;
      return '#'.repeat(level) + ' ' + content.map(nodeToMd).join('');
    }
    case 'paragraph': return content.length ? content.map(nodeToMd).join('') : '';
    case 'text': {
      let t = (node.text as string) || '';
      for (const mark of (node.marks as Record<string, string>[] || [])) {
        if (mark.type === 'bold') t = `**${t}**`;
        if (mark.type === 'italic') t = `*${t}*`;
        if (mark.type === 'code') t = `\`${t}\``;
      }
      return t;
    }
    case 'bulletList': return content.map(c => `- ${nodeToMd(c)}`).join('\n');
    case 'orderedList': return content.map((c, i) => `${i + 1}. ${nodeToMd(c)}`).join('\n');
    case 'listItem': return content.map(nodeToMd).join('');
    case 'taskList': return content.map(c => {
      const checked = (c.attrs as Record<string, boolean>)?.checked ? 'x' : ' ';
      return `- [${checked}] ${(c.content as Record<string, unknown>[]).map(nodeToMd).join('')}`;
    }).join('\n');
    case 'taskItem': return content.map(nodeToMd).join('');
    case 'blockquote': return content.map(c => `> ${nodeToMd(c)}`).join('\n');
    case 'codeBlock': {
      const lang = (node.attrs as Record<string, string>)?.language || '';
      const code = content.map(nodeToMd).join('');
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case 'horizontalRule': return '---';
    case 'image': return `![image](${(node.attrs as Record<string, string>)?.src || ''})`;
    case 'table': {
      const rows = content as Record<string, unknown>[];
      if (!rows.length) return '';
      const allRows = rows.map(row =>
        ((row.content as Record<string, unknown>[]) || []).map(cell =>
          ((cell.content as Record<string, unknown>[]) || []).map(nodeToMd).join('')
        )
      );
      const header = `| ${allRows[0].join(' | ')} |`;
      const sep = `| ${allRows[0].map(() => '---').join(' | ')} |`;
      const body = allRows.slice(1).map(r => `| ${r.join(' | ')} |`).join('\n');
      return `${header}\n${sep}\n${body}`;
    }
    case 'hardBreak': return '\n';
    default: return content.map(nodeToMd).join('') || (node.text as string) || '';
  }
}

export function tiptapJSONToMarkdown(jsonStr: string): string {
  try {
    const doc = JSON.parse(jsonStr) as Record<string, unknown>;
    return nodeToMd(doc);
  } catch { return jsonStr; }
}

// ─── Slash Commands ──────────────────────────────────────────
interface SlashCmd {
  label: string;
  icon: string;
  desc: string;
  keywords: string;
  action: (editor: ReturnType<typeof useEditor>) => void;
}

const SLASH_COMMANDS: SlashCmd[] = [
  {
    label: 'Asistente IA ✨', icon: '🤖', desc: 'Genera tablas, listas y texto al instante',
    keywords: 'ia ai asistente generate generar',
    action: () => {} // handled specially
  },
  {
    label: 'Tabla', icon: '⊞', desc: 'Insertar tabla con filas y columnas',
    keywords: 'tabla table grid',
    action: (e) => e?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  },
  {
    label: 'Heading 1', icon: 'H1', desc: 'Sección principal grande',
    keywords: 'heading titulo h1',
    action: (e) => e?.chain().focus().setHeading({ level: 1 }).run()
  },
  {
    label: 'Heading 2', icon: 'H2', desc: 'Sección secundaria',
    keywords: 'heading titulo h2',
    action: (e) => e?.chain().focus().setHeading({ level: 2 }).run()
  },
  {
    label: 'Heading 3', icon: 'H3', desc: 'Sección pequeña',
    keywords: 'heading titulo h3',
    action: (e) => e?.chain().focus().setHeading({ level: 3 }).run()
  },
  {
    label: 'Lista de viñetas', icon: '•', desc: 'Lista con puntos',
    keywords: 'list lista bullet viñetas',
    action: (e) => e?.chain().focus().toggleBulletList().run()
  },
  {
    label: 'Lista numerada', icon: '1.', desc: 'Lista ordenada',
    keywords: 'ordered lista numerada',
    action: (e) => e?.chain().focus().toggleOrderedList().run()
  },
  {
    label: 'To-do / Checklist', icon: '☑', desc: 'Lista de tareas con casillas',
    keywords: 'todo check task tarea pendiente',
    action: (e) => e?.chain().focus().toggleTaskList().run()
  },
  {
    label: 'Cita / Quote', icon: '"', desc: 'Resaltar una cita',
    keywords: 'quote cita blockquote',
    action: (e) => e?.chain().focus().toggleBlockquote().run()
  },
  {
    label: 'Código', icon: '</>', desc: 'Bloque de código con sintaxis',
    keywords: 'code codigo snippet',
    action: (e) => e?.chain().focus().toggleCodeBlock().run()
  },
  {
    label: 'Divisor', icon: '—', desc: 'Línea divisoria horizontal',
    keywords: 'divider divisor hr linea',
    action: (e) => e?.chain().focus().setHorizontalRule().run()
  },
  {
    label: 'Imagen', icon: '▣', desc: 'Subir imagen desde tu computador',
    keywords: 'image imagen foto',
    action: () => {} // handled specially
  },
];

// ─── Component Props ─────────────────────────────────────────
interface TiptapEditorProps {
  page: Page;
  onUpdate: (updaterOrPage: Page | ((page: Page) => Page)) => void;
}

// ─── Main Editor Component ───────────────────────────────────
const TiptapEditor: React.FC<TiptapEditorProps> = ({ page, onUpdate }) => {
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [bubblePos, setBubblePos] = useState({ top: 0, left: 0 });
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const slashMenuOpenRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const aiPromptRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  slashMenuOpenRef.current = slashMenuOpen;

  const getInitialContent = () => {
    if (page.content) {
      try { return JSON.parse(page.content); } catch { return page.content; }
    }
    if (page.blocks && page.blocks.length > 0) {
      return migrateBlocksToHTML(page.blocks);
    }
    return '';
  };

  const saveContent = useCallback((jsonContent: Record<string, unknown>) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      onUpdate(prev => ({
        ...prev,
        content: JSON.stringify(jsonContent),
        blocks: [], // clear legacy blocks after migration
        updatedAt: Date.now()
      }));
    }, 300);
  }, [onUpdate]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({ lowlight }),
      ImageExt.configure({ allowBase64: true }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'paragraph') return "Escribe o usa '/' para comandos…";
          return '';
        },
        showOnlyCurrent: true,
      }),
    ],
    content: getInitialContent(),
    onUpdate: ({ editor }) => {
      saveContent(editor.getJSON() as Record<string, unknown>);

      // Slash command detection (only when cursor is collapsed)
      const sel = editor.state.selection;
      if (!sel.empty) {
        // Update bubble menu position
        try {
          const startCoords = editor.view.coordsAtPos(sel.from);
          const endCoords = editor.view.coordsAtPos(sel.to);
          setBubblePos({ top: startCoords.top - 44, left: (startCoords.left + endCoords.left) / 2 });
          setBubbleVisible(true);
        } catch { setBubbleVisible(false); }
        setSlashMenuOpen(false);
        return;
      }
      setBubbleVisible(false);

      const $from = editor.state.doc.resolve(sel.from);
      const blockStart = $from.start($from.depth);
      const textInBlock = editor.state.doc.textBetween(blockStart, sel.from, '\0', '\0');

      if (textInBlock.startsWith('/')) {
        setSlashQuery(textInBlock.slice(1).toLowerCase());
        setSlashIndex(0);
        setSlashMenuOpen(true);
        try {
          const coords = editor.view.coordsAtPos(sel.from);
          setSlashPos({ top: coords.bottom + 6, left: coords.left });
        } catch { /* ignore */ }
      } else {
        setSlashMenuOpen(false);
        setSlashQuery('');
      }
    },
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (!slashMenuOpenRef.current) return false;
        if (event.key === 'Escape') { setSlashMenuOpen(false); return true; }
        if (event.key === 'ArrowDown') {
          setSlashIndex(prev => {
            const filtered = getFilteredCommands(slashQuery);
            return (prev + 1) % filtered.length;
          });
          return true;
        }
        if (event.key === 'ArrowUp') {
          setSlashIndex(prev => {
            const filtered = getFilteredCommands(slashQuery);
            return (prev - 1 + filtered.length) % filtered.length;
          });
          return true;
        }
        if (event.key === 'Enter') {
          // Defer to avoid editor Enter handling
          setTimeout(() => executeSlashCommand(slashIndex), 0);
          return true;
        }
        return false;
      }
    }
  });

  // Keep editor reference stable for slash command execution
  const editorRef = useRef(editor);
  useEffect(() => { editorRef.current = editor; }, [editor]);

  const getFilteredCommands = useCallback((query: string) => {
    if (!query) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(query) ||
      cmd.keywords.includes(query)
    );
  }, []);

  const deleteSlashText = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const { from } = ed.state.selection;
    const $from = ed.state.doc.resolve(from);
    const blockStart = $from.start($from.depth);
    const textInBlock = ed.state.doc.textBetween(blockStart, from, '\0', '\0');
    if (textInBlock.startsWith('/')) {
      ed.chain().focus()
        .deleteRange({ from: blockStart, to: from })
        .run();
    }
  }, []);

  const executeSlashCommand = useCallback((index: number) => {
    const filtered = getFilteredCommands(slashQuery);
    const cmd = filtered[index];
    if (!cmd) return;
    setSlashMenuOpen(false);
    setSlashQuery('');

    if (cmd.label.startsWith('Asistente')) {
      deleteSlashText();
      setShowAIDialog(true);
      return;
    }
    if (cmd.label === 'Imagen') {
      deleteSlashText();
      imageInputRef.current?.click();
      return;
    }
    deleteSlashText();
    cmd.action(editorRef.current);
  }, [slashQuery, getFilteredCommands, deleteSlashText]);

  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim() || isGenerating) return;
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 180));
    const md = generateFromPrompt(aiPrompt);
    // Convert Markdown to HTML for insertion
    const html = markdownToInsertHTML(md);
    editorRef.current?.chain().focus().insertContent(html).run();
    setShowAIDialog(false);
    setAIPrompt('');
    setIsGenerating(false);
  }, [aiPrompt, isGenerating]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      editorRef.current?.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleTitleBlur = useCallback((e: React.FocusEvent<HTMLHeadingElement>) => {
    const newTitle = e.currentTarget.textContent || '';
    onUpdate(prev => ({ ...prev, title: newTitle, updatedAt: Date.now() }));
  }, [onUpdate]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLHeadingElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editor?.commands.focus('start');
    }
  }, [editor]);

  // Focus AI prompt when dialog opens
  useEffect(() => {
    if (showAIDialog) {
      setTimeout(() => aiPromptRef.current?.focus(), 50);
    }
  }, [showAIDialog]);

  const filteredCmds = getFilteredCommands(slashQuery);

  const totalChars = page.content
    ? (() => { try { const d = JSON.parse(page.content) as Record<string, unknown>; return nodeToMd(d).replace(/\s/g, '').length; } catch { return 0; } })()
    : page.blocks.reduce((a, b) => a + b.content.length, 0);

  /* ── Editor ── */
  return (
    <div className="tiptap-editor-root" onMouseUp={() => {
      if (!editor) return;
      const { empty } = editor.state.selection;
      if (!empty) {
        try {
          const { from, to } = editor.state.selection;
          const startCoords = editor.view.coordsAtPos(from);
          const endCoords = editor.view.coordsAtPos(to);
          setBubblePos({ top: startCoords.top - 44, left: (startCoords.left + endCoords.left) / 2 });
          setBubbleVisible(true);
        } catch { setBubbleVisible(false); }
      } else { setBubbleVisible(false); }
    }}>
      {/* ── Title ── */}
      <h1
        ref={titleRef}
        className="tiptap-page-title"
        contentEditable
        suppressContentEditableWarning
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        data-placeholder="Sin título"
        spellCheck
      >
        {page.title}
      </h1>

      {/* ── Editor ── */}
      <div className="tiptap-editor-area">
      {/* ── Custom Bubble Menu ── */}
      {bubbleVisible && editor && !editor.state.selection.empty && (
        <div className="bubble-menu" style={{ top: bubblePos.top, left: bubblePos.left }}>
          <button className={`bubble-btn ${editor.isActive('bold') ? 'active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} title="Negrita (Ctrl+B)">B</button>
          <button className={`bubble-btn italic ${editor.isActive('italic') ? 'active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} title="Cursiva (Ctrl+I)">I</button>
          <button className={`bubble-btn ${editor.isActive('strike') ? 'active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }} title="Tachado">S</button>
          <button className={`bubble-btn code-btn ${editor.isActive('code') ? 'active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run(); }} title="Código inline">{`</>`}</button>
          <div className="bubble-sep" />
          <button className={`bubble-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().setHeading({ level: 1 }).run(); }}>H1</button>
          <button className={`bubble-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().setHeading({ level: 2 }).run(); }}>H2</button>
          <button className={`bubble-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}>•</button>
          <button className={`bubble-btn ${editor.isActive('taskList') ? 'active' : ''}`}
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleTaskList().run(); }}>☑</button>
        </div>
      )}

        <EditorContent editor={editor} className="tiptap-content" />
      </div>

      {/* ── Slash Command Menu ── */}
      {slashMenuOpen && filteredCmds.length > 0 && (
        <div
          className="slash-menu"
          style={{ top: slashPos.top, left: slashPos.left }}
        >
          <div className="slash-menu-header">Bloques</div>
          {filteredCmds.map((cmd, i) => (
            <div
              key={cmd.label}
              className={`slash-item ${i === slashIndex ? 'selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); executeSlashCommand(i); }}
              onMouseEnter={() => setSlashIndex(i)}
            >
              <span className="slash-icon">{cmd.icon}</span>
              <div className="slash-info">
                <div className="slash-label">{cmd.label}</div>
                <div className="slash-desc">{cmd.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── AI Dialog ── */}
      {showAIDialog && (
        <div className="ai-overlay" onClick={() => setShowAIDialog(false)}>
          <div className="ai-dialog" onClick={e => e.stopPropagation()}>
            <div className="ai-dialog-header">
              <span>🤖</span>
              <span>Asistente IA ✨</span>
              <span className="ai-dialog-hint">Instantáneo · Sin internet</span>
            </div>
            <textarea
              ref={aiPromptRef}
              className="ai-dialog-input"
              value={aiPrompt}
              onChange={e => setAIPrompt(e.target.value)}
              placeholder="Describe lo que necesitas: 'Tabla de rutina diaria', 'Lista to do de bañarme y cepillarme', 'Presupuesto mensual'..."
              rows={3}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAIGenerate(); }
                if (e.key === 'Escape') setShowAIDialog(false);
              }}
              disabled={isGenerating}
            />
            <div className="ai-dialog-actions">
              <button
                className="ai-cancel-btn"
                onClick={() => { setShowAIDialog(false); setAIPrompt(''); }}
              >Cancelar</button>
              <button
                className="ai-gen-btn"
                onClick={handleAIGenerate}
                disabled={!aiPrompt.trim() || isGenerating}
              >{isGenerating ? 'Generando...' : 'Generar ✨'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table Controls (when inside table) ── */}
      {editor?.isActive('table') && (
        <div className="table-controls">
          <button onClick={() => editor.chain().focus().addRowAfter().run()} title="Añadir fila">+ Fila</button>
          <button onClick={() => editor.chain().focus().addColumnAfter().run()} title="Añadir columna">+ Col</button>
          <button onClick={() => editor.chain().focus().deleteRow().run()} title="Eliminar fila">- Fila</button>
          <button onClick={() => editor.chain().focus().deleteColumn().run()} title="Eliminar columna">- Col</button>
          <button onClick={() => editor.chain().focus().deleteTable().run()} title="Eliminar tabla" style={{ color: 'var(--text-secondary)' }}>✕ Tabla</button>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="tiptap-footer">
        <span>{totalChars} caracteres</span>
      </div>

      {/* ── Hidden image input ── */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />
    </div>
  );
};

// ─── Markdown → HTML for AI output insertion ────────────────
function markdownToInsertHTML(md: string): string {
  // Tables
  if (md.trim().startsWith('|')) {
    return markdownTableToHTML(md);
  }
  const lines = md.split('\n');
  let html = '';
  let i = 0;
  const listBuffer: { type: 'ul' | 'ol' | 'task'; items: string[] } = { type: 'ul', items: [] };

  const flushList = () => {
    if (!listBuffer.items.length) return;
    if (listBuffer.type === 'task') {
      html += `<ul data-type="taskList">${listBuffer.items.map(t =>
        `<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${escH(t)}</p></div></li>`
      ).join('')}</ul>`;
    } else if (listBuffer.type === 'ul') {
      html += `<ul>${listBuffer.items.map(t => `<li><p>${escH(t)}</p></li>`).join('')}</ul>`;
    } else {
      html += `<ol>${listBuffer.items.map(t => `<li><p>${escH(t)}</p></li>`).join('')}</ol>`;
    }
    listBuffer.items = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { flushList(); i++; continue; }

    if (/^- \[ \] /i.test(trimmed)) {
      if (listBuffer.type !== 'task') { flushList(); listBuffer.type = 'task'; }
      listBuffer.items.push(trimmed.replace(/^- \[ \] /i, ''));
    } else if (/^- \[x\] /i.test(trimmed)) {
      if (listBuffer.type !== 'task') { flushList(); listBuffer.type = 'task'; }
      listBuffer.items.push(trimmed.replace(/^- \[x\] /i, ''));
    } else if (/^[-*] /.test(trimmed)) {
      if (listBuffer.type !== 'ul') { flushList(); listBuffer.type = 'ul'; }
      listBuffer.items.push(trimmed.replace(/^[-*] /, ''));
    } else if (/^\d+\. /.test(trimmed)) {
      if (listBuffer.type !== 'ol') { flushList(); listBuffer.type = 'ol'; }
      listBuffer.items.push(trimmed.replace(/^\d+\. /, ''));
    } else {
      flushList();
      if (trimmed.startsWith('# ')) html += `<h1>${escH(trimmed.slice(2))}</h1>`;
      else if (trimmed.startsWith('## ')) html += `<h2>${escH(trimmed.slice(3))}</h2>`;
      else if (trimmed.startsWith('### ')) html += `<h3>${escH(trimmed.slice(4))}</h3>`;
      else if (trimmed.startsWith('> ')) html += `<blockquote><p>${escH(trimmed.slice(2))}</p></blockquote>`;
      else if (/^---+$/.test(trimmed)) html += `<hr>`;
      else html += `<p>${escH(trimmed)}</p>`;
    }
    i++;
  }
  flushList();
  return html || '<p></p>';
}

export default TiptapEditor;
