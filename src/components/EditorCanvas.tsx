import React, { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { Page, Block } from '../App';
import './EditorCanvas.css';

interface EditorCanvasProps {
  page: Page;
  onUpdate: (page: Page) => void;
}

const COMMANDS = [
  { label: 'Text', command: 'p', icon: '🔤', desc: 'Just start writing with plain text.' },
  { label: 'Heading 1', command: 'h1', icon: '#', desc: 'Big section heading.' },
  { label: 'Heading 2', command: 'h2', icon: '##', desc: 'Medium section heading.' },
  { label: 'Heading 3', command: 'h3', icon: '###', desc: 'Small section heading.' },
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

const EditableBlock: React.FC<EditableBlockProps> = ({
  block,
  isFocused,
  onFocus,
  onChange,
  onKeyDown,
  innerRef
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  // Sync content from state to DOM, but only if they are different to prevent cursor jumping
  useEffect(() => {
    if (ref.current) {
      const currentText = ref.current.innerText;
      const normalizedCurrent = currentText.endsWith('\n') ? currentText.slice(0, -1) : currentText;
      if (normalizedCurrent !== block.content) {
        ref.current.innerText = block.content;
      }
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
      onInput={(e) => {
        const text = e.currentTarget.innerText;
        // Normalize trailing newline which browsers insert in contentEditable
        const normalized = text.endsWith('\n') ? text.slice(0, -1) : text;
        onChange(normalized);
      }}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      style={{
        textDecoration: block.type === 'todo' && block.checked ? 'line-through' : 'none',
        color: block.type === 'todo' && block.checked ? 'var(--text-tertiary)' : 'inherit'
      }}
    />
  );
};

const EditorCanvas: React.FC<EditorCanvasProps> = ({ page, onUpdate }) => {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);

  const updatePageTitle = (e: React.FormEvent<HTMLHeadingElement>) => {
    onUpdate({ ...page, title: e.currentTarget.textContent || '' });
  };

  const updateBlockContent = (index: number, content: string) => {
    const newBlocks = [...page.blocks];
    newBlocks[index].content = content;
    
    // Check for slash command
    if (content === '/') {
      openCommandMenu(index);
    } else if (commandMenuOpen && content.startsWith('/')) {
      setCommandQuery(content.slice(1));
    } else {
      setCommandMenuOpen(false);
    }

    onUpdate({ ...page, blocks: newBlocks });
  };

  const updateBlockType = (index: number, type: Block['type']) => {
    const newBlocks = [...page.blocks];
    newBlocks[index].type = type;
    newBlocks[index].content = newBlocks[index].content.replace(/^\/.*$/, ''); // clear command
    onUpdate({ ...page, blocks: newBlocks });
    setCommandMenuOpen(false);
    setFocusedIndex(index); // refocus
  };

  const toggleTodo = (index: number) => {
    const newBlocks = [...page.blocks];
    newBlocks[index].checked = !newBlocks[index].checked;
    onUpdate({ ...page, blocks: newBlocks });
  };

  const openCommandMenu = (index: number) => {
    const el = blockRefs.current[index];
    if (el) {
      const rect = el.getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 10, left: rect.left });
      setCommandMenuOpen(true);
      setCommandQuery('');
      setCommandIndex(0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
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
      const newBlocks = [...page.blocks];
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
      onUpdate({ ...page, blocks: newBlocks });
      setFocusedIndex(index + 1);
    }

    if (e.key === 'Backspace' && page.blocks[index].content === '') {
      e.preventDefault();
      if (page.blocks.length > 1) {
        const newBlocks = [...page.blocks];
        newBlocks.splice(index, 1);
        onUpdate({ ...page, blocks: newBlocks });
        setFocusedIndex(Math.max(0, index - 1));
      }
    }

    if (e.key === 'ArrowUp' && index > 0) {
      setFocusedIndex(index - 1);
    }
    
    if (e.key === 'ArrowDown' && index < page.blocks.length - 1) {
      setFocusedIndex(index + 1);
    }
  };

  const filteredCommands = COMMANDS.filter(cmd => 
    cmd.label.toLowerCase().includes(commandQuery.toLowerCase()) || 
    cmd.command.toLowerCase().includes(commandQuery.toLowerCase())
  );

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

