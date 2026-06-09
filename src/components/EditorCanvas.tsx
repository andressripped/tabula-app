import React, { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import type { Page, Block } from '../App';
import './EditorCanvas.css';

interface EditorCanvasProps {
  page: Page;
  onUpdate: (page: Page) => void;
}

const COMMANDS = [
  { label: 'Text', command: 'p', icon: 'T', desc: 'Just start writing with plain text.' },
  { label: 'Heading 1', command: 'h1', icon: 'H1', desc: 'Big section heading.' },
  { label: 'Heading 2', command: 'h2', icon: 'H2', desc: 'Medium section heading.' },
  { label: 'Heading 3', command: 'h3', icon: 'H3', desc: 'Small section heading.' },
  { label: 'Bulleted List', command: 'list', icon: '•', desc: 'Create a simple bulleted list.' },
  { label: 'To-do List', command: 'todo', icon: '☑', desc: 'Track tasks with a to-do list.' }
];

interface EditableBlockProps {
  block: Block;
  isFocused: boolean;
  onFocus: () => void;
  onChange: (content: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  innerRef: (el: HTMLDivElement | null) => void;
}

const EditableBlock: React.FC<EditableBlockProps> = React.memo(({
  block,
  isFocused,
  onFocus,
  onChange,
  onKeyDown,
  innerRef
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isComposing = useRef(false);
  // Track the last content we set from React to avoid infinite loops
  const lastSyncedContent = useRef(block.content);

  // Only sync content from React state -> DOM when the block's content 
  // was changed externally (e.g., command menu clearing the slash).
  // We compare against what we last pushed to avoid re-setting during typing.
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

  // Handle focus when requested by the parent
  useEffect(() => {
    if (isFocused && ref.current) {
      if (document.activeElement !== ref.current) {
        ref.current.focus();
        
        // Move caret to the end
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
    // Normalize trailing newline which browsers insert in contentEditable
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
      data-placeholder="Type '/' for commands"
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
  // Custom comparison: only re-render when something meaningful changes.
  // We do NOT re-render just because content changed (the DOM handles that).
  return (
    prevProps.block.id === nextProps.block.id &&
    prevProps.block.type === nextProps.block.type &&
    prevProps.block.checked === nextProps.block.checked &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.block.content === nextProps.block.content
  );
});

const EditorCanvas: React.FC<EditorCanvasProps> = ({ page, onUpdate }) => {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Use a ref to hold the latest page to avoid stale closures
  const pageRef = useRef(page);
  pageRef.current = page;

  // Use a ref for onUpdate to keep callbacks stable
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
    
    // Check for slash command
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
    const newBlocks = currentPage.blocks.map((b, i) =>
      i === index ? { ...b, type, content: b.content.replace(/^\/.*$/, '') } : b
    );
    onUpdateRef.current({ ...currentPage, blocks: newBlocks });
    setCommandMenuOpen(false);
    setFocusedIndex(index);
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
      // Keep list/todo types when pressing enter
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
          // Only move to previous block if cursor is at the very start
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
          // Only move to next block if cursor is at the very end
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
          {page.blocks.map((block, index) => (
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
          ))}
        </div>
        
        <div className="editor-footer">
          <span>{totalCharacters} caracteres</span>
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
