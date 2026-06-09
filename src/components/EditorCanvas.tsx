import React, { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import type { Page, Block } from '../App';
import './EditorCanvas.css';

interface EditorCanvasProps {
  page: Page;
  onUpdate: (page: Page) => void;
}

const COMMANDS = [
  { label: 'Text', command: 'p', icon: 'Aa', desc: 'Just start writing with plain text.' },
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
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
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
  const lastSyncedContent = useRef(block.content);

  useEffect(() => {
    if (ref.current && block.content !== lastSyncedContent.current) {
      const currentText = ref.current.innerText;
      const normalizedCurrent = currentText.endsWith('\n') ? currentText.slice(0, -1) : currentText;
      if (normalizedCurrent !== block.content) {
        ref.current.innerText = block.content;
      }
      lastSyncedContent.current = block.content;
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
    onChange(normalized);
  }, [onChange]);

  return (
    <div
      ref={(el) => {
        ref.current = el;
        innerRef(el);
      }}
      className="block-content"
      contentEditable
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
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
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
  const lastSyncedContent = useRef(block.content);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ref.current && block.content !== lastSyncedContent.current) {
      const currentText = ref.current.innerText;
      const normalizedCurrent = currentText.endsWith('\n') ? currentText.slice(0, -1) : currentText;
      if (normalizedCurrent !== block.content) {
        ref.current.innerText = block.content;
      }
      lastSyncedContent.current = block.content;
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
    onChange(normalized);
  }, [onChange]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(block.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [block.content]);

  const handleCodeKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    // Allow Enter for newlines inside code blocks (don't create new block)
    if (e.key === 'Enter' && !e.shiftKey) {
      // Let the browser handle the newline naturally in code blocks
      // But prevent the parent's Enter handler from firing
      e.stopPropagation();
      return;
    }
    // Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
      return;
    }
    onKeyDown(e);
  }, [onKeyDown]);

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <select
          className="code-language-select"
          value={block.language || 'plain'}
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          {CODE_LANGUAGES.map(lang => (
            <option key={lang} value={lang}>{lang}</option>
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
        contentEditable
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
    prevProps.block.language === nextProps.block.language &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.block.content === nextProps.block.content
  );
});

// ─────────────────────────────────────────────────────────────
// ImageBlock — image upload & display
// ─────────────────────────────────────────────────────────────
interface ImageBlockProps {
  block: Block;
  onImageUpload: (dataUrl: string) => void;
  onRemove: () => void;
}

const ImageBlock: React.FC<ImageBlockProps> = ({ block, onImageUpload, onRemove }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        onImageUpload(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  if (block.imageData) {
    return (
      <div className="image-block-container">
        <img src={block.imageData} alt="" className="image-block-img" />
        <div className="image-block-actions">
          <button className="image-action-btn" onClick={() => fileInputRef.current?.click()}>
            Replace
          </button>
          <button className="image-action-btn danger" onClick={onRemove}>
            Remove
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
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
// Main EditorCanvas
// ─────────────────────────────────────────────────────────────
const EditorCanvas: React.FC<EditorCanvasProps> = ({ page, onUpdate }) => {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const pageRef = useRef(page);
  pageRef.current = page;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const updatePageTitle = useCallback((e: React.FormEvent<HTMLHeadingElement>) => {
    const currentPage = pageRef.current;
    onUpdateRef.current({ ...currentPage, title: e.currentTarget.textContent || '' });
  }, []);

  const updateBlockContent = useCallback((index: number, content: string) => {
    const currentPage = pageRef.current;
    const newBlocks = currentPage.blocks.map((b, i) => 
      i === index ? { ...b, content } : b
    );
    
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

    onUpdateRef.current({ ...currentPage, blocks: newBlocks });
  }, []);

  const updateBlockType = useCallback((index: number, type: Block['type']) => {
    const currentPage = pageRef.current;
    
    // For non-editable blocks, just insert them
    if (type === 'divider') {
      const newBlocks = [...currentPage.blocks];
      newBlocks[index] = { ...newBlocks[index], type: 'divider', content: '' };
      // Add an empty paragraph after the divider for continued typing
      newBlocks.splice(index + 1, 0, {
        id: crypto.randomUUID(),
        type: 'p',
        content: '',
        checked: false
      });
      onUpdateRef.current({ ...currentPage, blocks: newBlocks });
      setCommandMenuOpen(false);
      setFocusedIndex(index + 1);
      return;
    }

    if (type === 'image') {
      const newBlocks = [...currentPage.blocks];
      newBlocks[index] = { ...newBlocks[index], type: 'image', content: '' };
      // Add an empty paragraph after the image for continued typing
      newBlocks.splice(index + 1, 0, {
        id: crypto.randomUUID(),
        type: 'p',
        content: '',
        checked: false
      });
      onUpdateRef.current({ ...currentPage, blocks: newBlocks });
      setCommandMenuOpen(false);
      setFocusedIndex(index + 1);
      return;
    }

    if (type === 'code') {
      const newBlocks = currentPage.blocks.map((b, i) =>
        i === index ? { ...b, type: type as Block['type'], content: '', language: 'javascript' } : b
      );
      onUpdateRef.current({ ...currentPage, blocks: newBlocks });
      setCommandMenuOpen(false);
      setFocusedIndex(index);
      return;
    }

    const newBlocks = currentPage.blocks.map((b, i) =>
      i === index ? { ...b, type, content: b.content.replace(/^\/.*$/, '') } : b
    );
    onUpdateRef.current({ ...currentPage, blocks: newBlocks });
    setCommandMenuOpen(false);
    setFocusedIndex(index);
  }, []);

  const updateBlockLanguage = useCallback((index: number, language: string) => {
    const currentPage = pageRef.current;
    const newBlocks = currentPage.blocks.map((b, i) =>
      i === index ? { ...b, language } : b
    );
    onUpdateRef.current({ ...currentPage, blocks: newBlocks });
  }, []);

  const updateBlockImage = useCallback((index: number, imageData: string) => {
    const currentPage = pageRef.current;
    const newBlocks = currentPage.blocks.map((b, i) =>
      i === index ? { ...b, imageData } : b
    );
    onUpdateRef.current({ ...currentPage, blocks: newBlocks });
  }, []);

  const removeBlockImage = useCallback((index: number) => {
    const currentPage = pageRef.current;
    const newBlocks = currentPage.blocks.map((b, i) =>
      i === index ? { ...b, imageData: undefined } : b
    );
    onUpdateRef.current({ ...currentPage, blocks: newBlocks });
  }, []);

  const toggleTodo = useCallback((index: number) => {
    const currentPage = pageRef.current;
    const newBlocks = currentPage.blocks.map((b, i) =>
      i === index ? { ...b, checked: !b.checked } : b
    );
    onUpdateRef.current({ ...currentPage, blocks: newBlocks });
  }, []);

  const filteredCommands = COMMANDS.filter(cmd => 
    cmd.label.toLowerCase().includes(commandQuery.toLowerCase()) || 
    cmd.command.toLowerCase().includes(commandQuery.toLowerCase())
  );

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, index: number) => {
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
      const currentPage = pageRef.current;
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
      onUpdateRef.current({ ...currentPage, blocks: newBlocks });
      setFocusedIndex(index + 1);
    }

    if (e.key === 'Backspace') {
      const currentPage = pageRef.current;
      const el = blockRefs.current[index];
      const currentContent = el ? el.innerText.trim() : currentPage.blocks[index].content;
      
      if (currentContent === '' && currentPage.blocks.length > 1) {
        e.preventDefault();
        const newBlocks = [...currentPage.blocks];
        newBlocks.splice(index, 1);
        onUpdateRef.current({ ...currentPage, blocks: newBlocks });
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


  const totalCharacters = page.blocks.reduce((acc, block) => acc + block.content.length, 0);

  // ─── Render block by type ──────────────────────────────────
  const renderBlock = (block: Block, index: number) => {
    switch (block.type) {
      case 'divider':
        return (
          <div className="block-wrapper block-divider" key={block.id}>
            <hr className="divider-line" />
          </div>
        );
      
      case 'image':
        return (
          <div className="block-wrapper block-image" key={block.id}>
            <ImageBlock
              block={block}
              onImageUpload={(data) => updateBlockImage(index, data)}
              onRemove={() => removeBlockImage(index)}
            />
          </div>
        );

      case 'code':
        return (
          <div className="block-wrapper block-code" key={block.id}>
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
          <div className="block-wrapper block-quote" key={block.id}>
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
          <div className="block-wrapper block-callout" key={block.id}>
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
          <div key={block.id} className={`block-wrapper block-${block.type}`}>
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
