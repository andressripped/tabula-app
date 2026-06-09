import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Page } from '../App';
import type { PageEmbeddings } from '../services/vectorDb';
import './SearchPalette.css';

interface SearchPaletteProps {
  pages: Page[];
  isOpen: boolean;
  onClose: () => void;
  onSelectPage: (id: string) => void;
  aiStatus: { embedding: 'idle' | 'loading' | 'ready'; llm: 'idle' | 'loading' | 'ready' | 'generating' };
  pageEmbeddings: Record<string, PageEmbeddings>;
  onEmbedQuery: (query: string) => Promise<number[]>;
  onInitEmbedding: () => void;
}

const SearchPalette: React.FC<SearchPaletteProps> = ({
  pages,
  isOpen,
  onClose,
  onSelectPage,
  aiStatus,
  pageEmbeddings,
  onEmbedQuery,
  onInitEmbedding
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>('keyword');
  const [semanticResults, setSemanticResults] = useState<{ page: Page; score: number; matchContent: string }[]>([]);
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const dotProduct = (a: number[], b: number[]): number => {
    let dot = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  };

  // 1. Keyword filtered pages
  const filteredPages = pages.filter(page => {
    if (!query) return true;
    const q = query.toLowerCase();
    if (page.title.toLowerCase().includes(q)) return true;
    return page.blocks.some(block => block.content.toLowerCase().includes(q));
  });

  // 2. Semantic search logic
  useEffect(() => {
    if (searchMode !== 'semantic' || !query.trim() || aiStatus.embedding !== 'ready') {
      setSemanticResults([]);
      return;
    }

    setIsSearchingSemantic(true);
    const timer = setTimeout(async () => {
      try {
        const queryVector = await onEmbedQuery(query);
        const results: { page: Page; score: number; matchContent: string }[] = [];

        for (const page of pages) {
          const emb = pageEmbeddings[page.id];
          if (!emb) continue;

          let maxScore = -1;
          let bestMatchText = '';

          // Title similarity
          if (emb.titleEmbedding) {
            const titleScore = dotProduct(queryVector, emb.titleEmbedding);
            if (titleScore > maxScore) {
              maxScore = titleScore;
              bestMatchText = page.title || 'Untitled';
            }
          }

          // Blocks similarity
          for (const block of page.blocks) {
            const blockEmb = emb.blocksEmbeddings[block.id];
            if (blockEmb) {
              const blockScore = dotProduct(queryVector, blockEmb);
              if (blockScore > maxScore) {
                maxScore = blockScore;
                bestMatchText = block.content;
              }
            }
          }

          // Relevancy threshold (0.25 to catch broad concepts)
          if (maxScore > 0.25) {
            results.push({
              page,
              score: maxScore,
              matchContent: bestMatchText
            });
          }
        }

        // Sort by similarity score descending
        results.sort((a, b) => b.score - a.score);
        setSemanticResults(results);
      } catch (err) {
        console.error('Semantic search query failed:', err);
      } finally {
        setIsSearchingSemantic(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, searchMode, pages, pageEmbeddings, aiStatus.embedding]);

  // List to display and index mapping
  const resultsCount = searchMode === 'keyword' ? filteredPages.length : semanticResults.length;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (resultsCount === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % resultsCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + resultsCount) % resultsCount);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchMode === 'keyword') {
        const selected = filteredPages[selectedIndex];
        if (selected) {
          onSelectPage(selected.id);
          onClose();
        }
      } else {
        const selected = semanticResults[selectedIndex];
        if (selected) {
          onSelectPage(selected.page.id);
          onClose();
        }
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredPages, semanticResults, searchMode, selectedIndex, resultsCount, onSelectPage, onClose]);

  if (!isOpen) return null;

  const getPreview = (page: Page): string => {
    const textBlocks = page.blocks.filter(b => b.content && b.type !== 'divider' && b.type !== 'image');
    if (textBlocks.length === 0) return 'Empty page';
    const preview = textBlocks.map(b => b.content).join(' ').slice(0, 100);
    return preview || 'Empty page';
  };

  const highlightMatch = (text: string): React.ReactNode => {
    if (!query || searchMode === 'semantic') return text;
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
        {/* Toggle Mode */}
        <div className="search-mode-tabs">
          <button
            className={`search-mode-btn ${searchMode === 'keyword' ? 'active' : ''}`}
            onClick={() => { setSearchMode('keyword'); setSelectedIndex(0); }}
          >
            🔍 Palabras Clave
          </button>
          <button
            className={`search-mode-btn ${searchMode === 'semantic' ? 'active' : ''}`}
            onClick={() => { setSearchMode('semantic'); setSelectedIndex(0); }}
          >
            🧠 Búsqueda Semántica (IA Local)
          </button>
        </div>

        <div className="search-input-wrapper">
          <svg className="search-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder={searchMode === 'keyword' ? "Buscar por palabras clave..." : "Buscar por concepto o significado (IA offline)..."}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          {isSearchingSemantic && (
            <div className="spinner" style={{ width: '14px', height: '14px', marginRight: '8px' }} />
          )}
          <span className="search-shortcut">esc</span>
        </div>

        <div className="search-results">
          {searchMode === 'semantic' && aiStatus.embedding !== 'ready' ? (
            <div className="search-empty" style={{ padding: '30px 20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <div>La búsqueda semántica requiere descargar un modelo liviano (23 MB).</div>
              {aiStatus.embedding === 'loading' ? (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando modelo...</div>
              ) : (
                <button className="primary-btn" onClick={onInitEmbedding} style={{ fontSize: '12px', padding: '6px 14px' }}>
                  Activar Búsqueda Semántica
                </button>
              )}
            </div>
          ) : resultsCount === 0 ? (
            <div className="search-empty">No se encontraron resultados</div>
          ) : searchMode === 'keyword' ? (
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
                  <div className="search-result-title">{highlightMatch(page.title || 'Sin título')}</div>
                  <div className="search-result-preview">{getPreview(page)}</div>
                </div>
              </div>
            ))
          ) : (
            semanticResults.map((result, i) => (
              <div
                key={result.page.id}
                className={`search-result-item ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onSelectPage(result.page.id);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="search-result-icon">{result.page.icon || '📄'}</span>
                <div className="search-result-info">
                  <div className="search-result-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{result.page.title || 'Sin título'}</span>
                    <span className="search-score-badge">
                      {Math.round(result.score * 100)}% match
                    </span>
                  </div>
                  <div className="search-result-preview">
                    {result.matchContent ? `Match: "${result.matchContent.slice(0, 100)}..."` : getPreview(result.page)}
                  </div>
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
