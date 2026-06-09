import React, { useState, useRef, useEffect, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Page, Block } from '../App';
import './EditorCanvas.css';

interface EditorCanvasProps {
  page: Page;
  onUpdate: (updaterOrPage: Page | ((page: Page) => Page)) => void;
  aiStatus: { embedding: 'idle' | 'loading' | 'ready'; llm: 'idle' | 'loading' | 'ready' | 'generating' };
  onGenerateText: (prompt: string) => Promise<string>;
  onInitLLM: () => void;
}

const COMMANDS = [
  { label: 'Text', command: 'p', icon: 'Aa', desc: 'Just start writing with plain text.' },
  { label: 'Preguntar a la IA (Local)', command: 'ai', icon: '🤖', desc: 'Generar tablas o texto de forma local y privada.' },
  { label: 'Heading 1', command: 'h1', icon: 'H1', desc: 'Big section heading.' },
  { label: 'Heading 2', command: 'h2', icon: 'H2', desc: 'Medium section heading.' },
  { label: 'Heading 3', command: 'h3', icon: 'H3', desc: 'Small section heading.' },
  { label: 'Bulleted List', command: 'list', icon: '•', desc: 'Create a simple bulleted list.' },
  { label: 'To-do List', command: 'todo', icon: '☑', desc: 'Track tasks with a to-do list.' },
  { label: 'Quote', command: 'quote', icon: '"', desc: 'Capture a quote.' },
  { label: 'Callout', command: 'callout', icon: '!', desc: 'Make text stand out.' },
  { label: 'Code', command: 'code', icon: '</>', desc: 'Capture a code snippet.' },
  { label: 'Divider', command: 'divider', icon: '—', desc: 'Visually divide blocks.' },
  { label: 'Image', command: 'image', icon: '▣', desc: 'Upload an image from your computer.' }
];

const CODE_LANGUAGES = [
  'plain', 'javascript', 'typescript', 'python', 'html', 'css', 'json', 'bash', 'sql', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'ruby', 'php'
];

// ─────────────────────────────────────────────────────────────
// EditableBlock — handles contentEditable without cursor issues
// ─────────────────────────────────────────────────────────────
interface EditableBlockProps {
  block: Block;
  isFocused: boolean;
  onFocus: () => void;
  onChange: (content: string) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  innerRef: (el: HTMLDivElement | null) => void;
  placeholder?: string;
}

const EditableBlock: React.FC<EditableBlockProps> = React.memo(({
  block,
  isFocused,
  onFocus,
  onChange,
  onKeyDown,
  innerRef,
  placeholder = "Type '/' for commands"
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isComposing = useRef(false);
  const lastSyncedContent = useRef<string | null>(null);
  const isLocalChange = useRef(false);

  useEffect(() => {
    if (ref.current) {
      if (isLocalChange.current) {
        if (block.content === lastSyncedContent.current) {
          isLocalChange.current = false;
        }
        return;
      }

      if (block.content !== lastSyncedContent.current) {
        const currentText = ref.current.innerText;
        const normalizedCurrent = currentText.endsWith('\n') ? currentText.slice(0, -1) : currentText;
        if (normalizedCurrent !== block.content) {
          ref.current.innerText = block.content;
        }
        lastSyncedContent.current = block.content;
      }
    }
  }, [block.content]);

  useEffect(() => {
    if (isFocused && ref.current) {
      if (document.activeElement !== ref.current) {
        ref.current.focus();
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(ref.current);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  }, [isFocused]);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (isComposing.current) return;
    const text = e.currentTarget.innerText;
    const normalized = text.endsWith('\n') ? text.slice(0, -1) : text;
    lastSyncedContent.current = normalized;
    isLocalChange.current = true;
    onChange(normalized);
  }, [onChange]);

  return (
    <div
      ref={(el) => {
        ref.current = el;
        innerRef(el);
      }}
      className="block-content"
      contentEditable={isFocused}
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={handleInput}
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={(e) => {
        isComposing.current = false;
        handleInput(e as unknown as React.FormEvent<HTMLDivElement>);
      }}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      style={{
        textDecoration: block.type === 'todo' && block.checked ? 'line-through' : 'none',
        color: block.type === 'todo' && block.checked ? 'var(--text-tertiary)' : 'inherit'
      }}
    />
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.block.id === nextProps.block.id &&
    prevProps.block.type === nextProps.block.type &&
    prevProps.block.checked === nextProps.block.checked &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.block.content === nextProps.block.content
  );
});

// ─────────────────────────────────────────────────────────────
// CodeBlock — special block with language selector & copy button
// ─────────────────────────────────────────────────────────────
interface CodeBlockProps {
  block: Block;
  isFocused: boolean;
  onFocus: () => void;
  onChange: (content: string) => void;
  onLanguageChange: (lang: string) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  innerRef: (el: HTMLDivElement | null) => void;
}

const CodeBlock: React.FC<CodeBlockProps> = React.memo(({
  block,
  isFocused,
  onFocus,
  onChange,
  onLanguageChange,
  onKeyDown,
  innerRef
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isComposing = useRef(false);
  const lastSyncedContent = useRef<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isLocalChange = useRef(false);

  useEffect(() => {
    if (ref.current) {
      if (isLocalChange.current) {
        if (block.content === lastSyncedContent.current) {
          isLocalChange.current = false;
        }
        return;
      }

      if (block.content !== lastSyncedContent.current) {
        const currentText = ref.current.innerText;
        const normalizedCurrent = currentText.endsWith('\n') ? currentText.slice(0, -1) : currentText;
        if (normalizedCurrent !== block.content) {
          ref.current.innerText = block.content;
        }
        lastSyncedContent.current = block.content;
      }
    }
  }, [block.content]);

  useEffect(() => {
    if (isFocused && ref.current) {
      if (document.activeElement !== ref.current) {
        ref.current.focus();
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(ref.current);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    }
  }, [isFocused]);

  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (isComposing.current) return;
    const text = e.currentTarget.innerText;
    const normalized = text.endsWith('\n') ? text.slice(0, -1) : text;
    lastSyncedContent.current = normalized;
    isLocalChange.current = true;
    onChange(normalized);
  }, [onChange]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(block.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [block.content]);

  const handleCodeKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.stopPropagation();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && ref.current) {
        const range = selection.getRangeAt(0);
        const tabNode = document.createTextNode('  ');
        range.insertNode(tabNode);
        range.setStartAfter(tabNode);
        range.setEndAfter(tabNode);
        selection.removeAllRanges();
        selection.addRange(range);
        const text = ref.current.innerText;
        const normalized = text.endsWith('\n') ? text.slice(0, -1) : text;
        lastSyncedContent.current = normalized;
        onChange(normalized);
      }
      return;
    }
    onKeyDown(e);
  }, [onKeyDown, onChange]);

  return (
    <div className="code-block-container">
      <div className="code-block-header" contentEditable={false}>
        <select
          className="code-lang-select"
          value={block.language || 'javascript'}
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          {CODE_LANGUAGES.map(lang => (
            <option key={lang} value={lang}>{lang.toUpperCase()}</option>
          ))}
        </select>
        <button className="code-copy-btn" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div
        ref={(el) => {
          ref.current = el;
          innerRef(el);
        }}
        className="code-block-content"
        contentEditable={isFocused}
        suppressContentEditableWarning
        data-placeholder="Write your code..."
        onInput={handleInput}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={(e) => {
          isComposing.current = false;
          handleInput(e as unknown as React.FormEvent<HTMLDivElement>);
        }}
        onKeyDown={handleCodeKeyDown}
        onFocus={onFocus}
        spellCheck={false}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.block.id === nextProps.block.id &&
    prevProps.block.type === nextProps.block.type &&
    prevProps.block.checked === nextProps.block.checked &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.block.content === nextProps.block.content &&
    prevProps.block.language === nextProps.block.language
  );
});

// ─────────────────────────────────────────────────────────────
// ImageBlock — handles local image uploads
// ─────────────────────────────────────────────────────────────
interface ImageBlockProps {
  block: Block;
  onImageUpload: (base64Data: string) => void;
  onRemove: () => void;
}

const ImageBlock: React.FC<ImageBlockProps> = ({ block, onImageUpload, onRemove }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === 'string') {
          onImageUpload(event.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (block.imageData) {
    return (
      <div className="image-block-wrapper">
        <img src={block.imageData} alt="Embedded content" className="embedded-image" />
        <button className="image-remove-btn" onClick={onRemove} title="Remove image">
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="image-block-placeholder" onClick={() => fileInputRef.current?.click()}>
      <div className="image-placeholder-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
      <span>Click to upload an image</span>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// AIBlock — inline local AI generation interface
// ─────────────────────────────────────────────────────────────
interface AIBlockProps {
  aiStatus: { embedding: 'idle' | 'loading' | 'ready'; llm: 'idle' | 'loading' | 'ready' | 'generating' };
  onGenerate: (prompt: string) => void;
  onCancel: () => void;
  onInitLLM: () => void;
}

const AIBlock: React.FC<AIBlockProps> = ({ aiStatus, onGenerate, onCancel, onInitLLM }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && aiStatus.llm === 'ready') {
      onGenerate(prompt);
    }
  };

  return (
    <div className="ai-block-container" contentEditable={false} style={{
      background: 'rgba(110, 91, 250, 0.05)',
      border: '1px dashed var(--accent)',
      borderRadius: '8px',
      padding: '16px',
      margin: '8px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--accent)' }}>
        <span style={{ fontSize: '16px' }}>🤖</span>
        <span>Asistente de IA Local (Offline)</span>
      </div>

      {aiStatus.llm === 'idle' || aiStatus.llm === 'loading' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            El Asistente de IA requiere descargar un modelo de lenguaje local (~950 MB). Puedes descargarlo aquí o desde Ajustes.
          </p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            {aiStatus.llm === 'loading' ? (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando modelo...</span>
            ) : (
              <button className="primary-btn" onClick={onInitLLM} style={{ fontSize: '12px', padding: '6px 14px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
                Descargar Modelo
              </button>
            )}
            <button className="close-btn" onClick={onCancel} style={{ fontSize: '12px', padding: '6px 14px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <textarea
            className="ai-prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Escribe lo que necesitas (Ej. 'Crea una tabla con las tareas del proyecto, responsable y prioridad')..."
            style={{
              width: '100%',
              minHeight: '60px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              padding: '10px',
              fontSize: '13px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'var(--font-family)'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={aiStatus.llm === 'generating'}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="close-btn"
              onClick={onCancel}
              style={{ fontSize: '12px', padding: '6px 14px', border: '1px solid var(--border)', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}
              disabled={aiStatus.llm === 'generating'}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-btn"
              style={{ fontSize: '12px', padding: '6px 14px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}
              disabled={!prompt.trim() || aiStatus.llm === 'generating'}
            >
              {aiStatus.llm === 'generating' ? 'Generando...' : 'Generar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

function parseMarkdownToBlocks(md: string): Omit<Block, 'id'>[] {
  const lines = md.split('\n');
  const blocks: Omit<Block, 'id'>[] = [];
  
  let inCodeBlock = false;
  let codeContent = '';
  let codeLang = 'plain';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          type: 'code',
          content: codeContent.trim(),
          language: codeLang
        });
        inCodeBlock = false;
        codeContent = '';
      } else {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim() || 'plain';
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeContent += line + '\n';
      continue;
    }
    
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Headings
    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'h1', content: trimmed.slice(2) });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', content: trimmed.slice(3) });
    } else if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', content: trimmed.slice(4) });
    }
    // Lists & Todo
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.slice(2);
      if (content.startsWith('[ ]') || content.startsWith('[x]')) {
        blocks.push({
          type: 'todo',
          content: content.slice(3).trim(),
          checked: content.startsWith('[x]')
        });
      } else {
        blocks.push({ type: 'list', content });
      }
    }
    // Quote
    else if (trimmed.startsWith('> ')) {
      blocks.push({ type: 'quote', content: trimmed.slice(2) });
    }
    // Markdown table block
    else if (trimmed.startsWith('|')) {
      let tableContent = trimmed + '\n';
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
        tableContent += lines[i + 1].trim() + '\n';
        i++;
      }
      blocks.push({
        type: 'code',
        content: tableContent.trim(),
        language: 'markdown'
      });
    }
    // Paragraph
    else {
      blocks.push({ type: 'p', content: trimmed });
    }
  }
  
  if (blocks.length === 0) {
    blocks.push({ type: 'p', content: md });
  }
  
  return blocks;
}

// ─────────────────────────────────────────────────────────────
// Main EditorCanvas
// ─────────────────────────────────────────────────────────────
const EditorCanvas: React.FC<EditorCanvasProps> = ({
  page,
  onUpdate,
  aiStatus,
  onGenerateText,
  onInitLLM
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const pageRef = useRef(page);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    pageRef.current = page;
    onUpdateRef.current = onUpdate;
  });

  const updatePageTitle = useCallback((e: React.FormEvent<HTMLHeadingElement>) => {
    const newTitle = e.currentTarget.textContent || '';
    onUpdateRef.current(currentPage => ({ ...currentPage, title: newTitle }));
  }, []);

  const handleAICancel = useCallback((index: number) => {
    onUpdateRef.current(currentPage => {
      const newBlocks = [...currentPage.blocks];
      newBlocks[index] = { ...newBlocks[index], type: 'p', content: '' };
      return { ...currentPage, blocks: newBlocks };
    });
    setFocusedIndex(index);
  }, []);

  const handleAIGenerate = useCallback(async (index: number, prompt: string) => {
    try {
      const generatedText = await onGenerateText(prompt);
      const parsedBlocks = parseMarkdownToBlocks(generatedText).map(b => ({
        ...b,
        id: crypto.randomUUID()
      }));

      onUpdateRef.current(currentPage => {
        const newBlocks = [...currentPage.blocks];
        newBlocks.splice(index, 1, ...parsedBlocks);
        return { ...currentPage, blocks: newBlocks };
      });

      setFocusedIndex(index);
    } catch (err) {
      console.error('Failed to generate AI content:', err);
    }
  }, [onGenerateText]);

  const updateBlockContent = useCallback((index: number, content: string) => {
    onUpdateRef.current(currentPage => {
      const newBlocks = currentPage.blocks.map((b, i) => 
        i === index ? { ...b, content } : b
      );
      return { ...currentPage, blocks: newBlocks };
    });
    
    if (content === '/') {
      const el = blockRefs.current[index];
      if (el) {
        const rect = el.getBoundingClientRect();
        setMenuPosition({ top: rect.bottom + 10, left: rect.left });
        setCommandMenuOpen(true);
        setCommandQuery('');
        setCommandIndex(0);
      }
    } else if (content.startsWith('/')) {
      setCommandQuery(content.slice(1));
    } else {
      setCommandMenuOpen(false);
    }
  }, []);

  const updateBlockType = useCallback((index: number, type: Block['type']) => {
    if (type === 'divider') {
      onUpdateRef.current(currentPage => {
        const newBlocks = [...currentPage.blocks];
        newBlocks[index] = { ...newBlocks[index], type: 'divider' as const, content: '' };
        newBlocks.splice(index + 1, 0, {
          id: crypto.randomUUID(),
          type: 'p' as const,
          content: '',
          checked: false
        });
        return { ...currentPage, blocks: newBlocks };
      });
      setCommandMenuOpen(false);
      setFocusedIndex(index + 1);
      return;
    }

    if (type === 'image') {
      onUpdateRef.current(currentPage => {
        const newBlocks = [...currentPage.blocks];
        newBlocks[index] = { ...newBlocks[index], type: 'image' as const, content: '' };
        newBlocks.splice(index + 1, 0, {
          id: crypto.randomUUID(),
          type: 'p' as const,
          content: '',
          checked: false
        });
        return { ...currentPage, blocks: newBlocks };
      });
      setCommandMenuOpen(false);
      setFocusedIndex(index + 1);
      return;
    }

    if (type === 'code') {
      onUpdateRef.current(currentPage => {
        const newBlocks = currentPage.blocks.map((b, i) =>
          i === index ? { ...b, type: 'code' as const, content: '', language: 'javascript' } : b
        );
        return { ...currentPage, blocks: newBlocks };
      });
      setCommandMenuOpen(false);
      setFocusedIndex(index);
      return;
    }

    onUpdateRef.current(currentPage => {
      const newBlocks = currentPage.blocks.map((b, i) =>
        i === index ? { ...b, type, content: b.content.replace(/^\/.*$/, '') } : b
      );
      return { ...currentPage, blocks: newBlocks };
    });
    setCommandMenuOpen(false);
    setFocusedIndex(index);
  }, []);

  const updateBlockLanguage = useCallback((index: number, language: string) => {
    onUpdateRef.current(currentPage => {
      const newBlocks = currentPage.blocks.map((b, i) =>
        i === index ? { ...b, language } : b
      );
      return { ...currentPage, blocks: newBlocks };
    });
  }, []);

  const updateBlockImage = useCallback((index: number, imageData: string) => {
    onUpdateRef.current(currentPage => {
      const newBlocks = currentPage.blocks.map((b, i) =>
        i === index ? { ...b, imageData } : b
      );
      return { ...currentPage, blocks: newBlocks };
    });
  }, []);

  const removeBlockImage = useCallback((index: number) => {
    onUpdateRef.current(currentPage => {
      const newBlocks = currentPage.blocks.map((b, i) =>
        i === index ? { ...b, imageData: undefined } : b
      );
      return { ...currentPage, blocks: newBlocks };
    });
  }, []);

  const toggleTodo = useCallback((index: number) => {
    onUpdateRef.current(currentPage => {
      const newBlocks = currentPage.blocks.map((b, i) =>
        i === index ? { ...b, checked: !b.checked } : b
      );
      return { ...currentPage, blocks: newBlocks };
    });
  }, []);

  const filteredCommands = COMMANDS.filter(cmd => 
    cmd.label.toLowerCase().includes(commandQuery.toLowerCase()) || 
    cmd.command.toLowerCase().includes(commandQuery.toLowerCase())
  );

  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>, index: number) => {
    if (commandMenuOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCommandIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCommandIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selectedCommand = filteredCommands[commandIndex];
        if (selectedCommand) {
          updateBlockType(index, selectedCommand.command as Block['type']);
        }
        return;
      }
      if (e.key === 'Escape') {
        setCommandMenuOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onUpdateRef.current(currentPage => {
        const newBlocks = [...currentPage.blocks];
        const newType = (newBlocks[index].type === 'list' || newBlocks[index].type === 'todo') 
          ? newBlocks[index].type 
          : 'p';
        newBlocks.splice(index + 1, 0, {
          id: crypto.randomUUID(),
          type: newType,
          content: '',
          checked: false
        });
        return { ...currentPage, blocks: newBlocks };
      });
      setFocusedIndex(index + 1);
    }

    if (e.key === 'Backspace') {
      const currentPage = pageRef.current;
      const el = blockRefs.current[index];
      const currentContent = el ? el.innerText.trim() : currentPage.blocks[index].content;
      
      if (currentContent === '') {
        e.preventDefault();
        onUpdateRef.current(latestPage => {
          if (latestPage.blocks.length > 1) {
            const newBlocks = [...latestPage.blocks];
            newBlocks.splice(index, 1);
            return { ...latestPage, blocks: newBlocks };
          }
          return latestPage;
        });
        setFocusedIndex(Math.max(0, index - 1));
      }
    }

    if (e.key === 'ArrowUp' && index > 0) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const el = blockRefs.current[index];
        if (el) {
          const preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(el);
          preCaretRange.setEnd(range.startContainer, range.startOffset);
          if (preCaretRange.toString().length === 0) {
            e.preventDefault();
            setFocusedIndex(index - 1);
          }
        }
      }
    }
    
    if (e.key === 'ArrowDown' && index < pageRef.current.blocks.length - 1) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const el = blockRefs.current[index];
        if (el) {
          const postCaretRange = range.cloneRange();
          postCaretRange.selectNodeContents(el);
          postCaretRange.setStart(range.endContainer, range.endOffset);
          if (postCaretRange.toString().length === 0) {
            e.preventDefault();
            setFocusedIndex(index + 1);
          }
        }
      }
    }
  }, [commandMenuOpen, commandIndex, filteredCommands, updateBlockType]);

  const totalCharacters = page.blocks.reduce((acc, block) => acc + [...block.content].length, 0);

  // ─── Render block by type ──────────────────────────────────
  const renderBlock = (block: Block, index: number) => {
    const wrapperClass = `block-wrapper block-${block.type}`;
    
    const blockProps = {
      className: wrapperClass,
      key: block.id
    };

    switch (block.type) {
      case 'divider':
        return (
          <div {...blockProps}>
            <hr className="divider-line" />
          </div>
        );
      
      case 'image':
        return (
          <div {...blockProps}>
            <ImageBlock
              block={block}
              onImageUpload={(data) => updateBlockImage(index, data)}
              onRemove={() => removeBlockImage(index)}
            />
          </div>
        );

      case 'ai':
        return (
          <div {...blockProps}>
            <AIBlock
              aiStatus={aiStatus}
              onGenerate={(prompt) => handleAIGenerate(index, prompt)}
              onCancel={() => handleAICancel(index)}
              onInitLLM={onInitLLM}
            />
          </div>
        );

      case 'code':
        return (
          <div {...blockProps}>
            <CodeBlock
              block={block}
              isFocused={focusedIndex === index}
              onFocus={() => setFocusedIndex(index)}
              onChange={(content) => updateBlockContent(index, content)}
              onLanguageChange={(lang) => updateBlockLanguage(index, lang)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              innerRef={(el) => { blockRefs.current[index] = el; }}
            />
          </div>
        );

      case 'quote':
        return (
          <div {...blockProps}>
            <div className="quote-bar" />
            <EditableBlock
              block={block}
              isFocused={focusedIndex === index}
              onFocus={() => setFocusedIndex(index)}
              onChange={(content) => updateBlockContent(index, content)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              innerRef={(el) => { blockRefs.current[index] = el; }}
              placeholder="Write a quote..."
            />
          </div>
        );

      case 'callout':
        return (
          <div {...blockProps}>
            <div className="callout-icon">i</div>
            <EditableBlock
              block={block}
              isFocused={focusedIndex === index}
              onFocus={() => setFocusedIndex(index)}
              onChange={(content) => updateBlockContent(index, content)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              innerRef={(el) => { blockRefs.current[index] = el; }}
              placeholder="Type a callout..."
            />
          </div>
        );

      default:
        return (
          <div {...blockProps}>
            {block.type === 'todo' && (
              <div 
                className={`todo-checkbox ${block.checked ? 'checked' : ''}`}
                onClick={() => toggleTodo(index)}
              />
            )}
            {block.type === 'list' && <span className="list-bullet">•</span>}
            <EditableBlock
              block={block}
              isFocused={focusedIndex === index}
              onFocus={() => setFocusedIndex(index)}
              onChange={(content) => updateBlockContent(index, content)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              innerRef={(el) => { blockRefs.current[index] = el; }}
            />
          </div>
        );
    }
  };

  return (
    <div className="editor-canvas">
      <div className="editor-inner">
        <h1 
          className="page-title-input" 
          contentEditable 
          suppressContentEditableWarning 
          onBlur={updatePageTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (page.blocks.length > 0) setFocusedIndex(0);
            }
          }}
        >
          {page.title}
        </h1>

        <div className="blocks-container">
          {page.blocks.map((block, index) => renderBlock(block, index))}
        </div>
        
        <div className="editor-footer">
          <span>{totalCharacters} characters</span>
        </div>
      </div>

      {commandMenuOpen && (
        <div 
          className="command-menu" 
          style={{ top: menuPosition.top, left: menuPosition.left }}
        >
          <div className="command-menu-header">Basic blocks</div>
          {filteredCommands.map((cmd, i) => (
            <div 
              key={cmd.command} 
              className={`command-item ${i === commandIndex ? 'selected' : ''}`}
              onClick={() => updateBlockType(focusedIndex!, cmd.command as Block['type'])}
              onMouseEnter={() => setCommandIndex(i)}
            >
              <div className="command-icon">{cmd.icon}</div>
              <div className="command-info">
                <div className="command-label">{cmd.label}</div>
                <div className="command-desc">{cmd.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EditorCanvas;
