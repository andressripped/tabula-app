import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Page } from '../App';
import './SearchPalette.css';

interface SearchPaletteProps {
  pages: Page[];
  isOpen: boolean;
  onClose: () => void;
  onSelectPage: (id: string) => void;
}

const SearchPalette: React.FC<SearchPaletteProps> = ({ pages, isOpen, onClose, onSelectPage }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const filteredPages = pages.filter(page => {
    if (!query) return true;
    const q = query.toLowerCase();
    if (page.title.toLowerCase().includes(q)) return true;
    return page.blocks.some(block => block.content.toLowerCase().includes(q));
  });

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredPages.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredPages.length) % filteredPages.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredPages[selectedIndex];
      if (selected) {
        onSelectPage(selected.id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredPages, selectedIndex, onSelectPage, onClose]);

  if (!isOpen) return null;

  const getPreview = (page: Page): string => {
    const textBlocks = page.blocks.filter(b => b.content && b.type !== 'divider' && b.type !== 'image');
    if (textBlocks.length === 0) return 'Empty page';
    const preview = textBlocks.map(b => b.content).join(' ').slice(0, 100);
    return preview || 'Empty page';
  };

  const highlightMatch = (text: string): React.ReactNode => {
    if (!query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="search-highlight">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-palette" onClick={e => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <svg className="search-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search pages..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <span className="search-shortcut">esc</span>
        </div>
        <div className="search-results">
          {filteredPages.length === 0 ? (
            <div className="search-empty">No results found</div>
          ) : (
            filteredPages.map((page, i) => (
              <div
                key={page.id}
                className={`search-result-item ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onSelectPage(page.id);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="search-result-icon">{page.icon || '📄'}</span>
                <div className="search-result-info">
                  <div className="search-result-title">{highlightMatch(page.title || 'Untitled')}</div>
                  <div className="search-result-preview">{getPreview(page)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPalette;
