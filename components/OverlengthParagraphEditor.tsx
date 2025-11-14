/**
 * Overlength Paragraph Editor
 * 
 * Provides UI for manually editing/splitting paragraphs that exceed 1000 characters.
 * Features:
 * - List all overlength paragraphs with character counts
 * - Edit paragraph content directly
 * - Split paragraphs at cursor position
 * - Real-time character count indicator
 * - Bulk operations support
 */

import React, { useState, useEffect, useRef } from 'react';

interface OverlengthParagraph {
  id: number;
  book_id: string;
  paragraph_index: number;
  content: string;
  char_count: number;
  meta: any;
  created_at: string | null;
}

interface OverlengthParagraphEditorProps {
  bookId?: string;
}

export const OverlengthParagraphEditor: React.FC<OverlengthParagraphEditorProps> = ({ bookId }) => {
  const [paragraphs, setParagraphs] = useState<OverlengthParagraph[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadOverlengthParagraphs();
  }, [bookId]);

  const loadOverlengthParagraphs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (bookId) params.append('book_id', bookId);
      params.append('limit', '100');
      
      const response = await fetch(`/api/v1/books/paragraphs/overlength?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setParagraphs(data.paragraphs || []);
      } else {
        setError(data.message || 'Failed to load overlength paragraphs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (para: OverlengthParagraph) => {
    setEditingId(para.id);
    setEditContent(para.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSave = async (id: number) => {
    try {
      const response = await fetch(`/api/v1/books/paragraphs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent,
          clear_overlength_flag: true
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Refresh list
        await loadOverlengthParagraphs();
        setEditingId(null);
        setEditContent('');
      } else {
        alert(`Save failed: ${data.message}`);
      }
    } catch (err) {
      alert(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSplitAtCursor = async (id: number) => {
    if (!textareaRef.current) return;
    
    const splitPos = textareaRef.current.selectionStart;
    
    if (splitPos <= 0 || splitPos >= editContent.length) {
      alert('Please place cursor at desired split position');
      return;
    }
    
    const confirmed = confirm(
      `Split paragraph at position ${splitPos}?\n\n` +
      `First part (${splitPos} chars): "${editContent.substring(0, Math.min(splitPos, 50))}..."\n\n` +
      `Second part (${editContent.length - splitPos} chars): "${editContent.substring(splitPos, Math.min(splitPos + 50, editContent.length))}..."`
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/v1/books/paragraphs/${id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          split_position: splitPos,
          insert_separator: true
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`Split successful! Created new paragraph #${data.new_id}`);
        await loadOverlengthParagraphs();
        setEditingId(null);
        setEditContent('');
      } else {
        alert(`Split failed: ${data.message}`);
      }
    } catch (err) {
      alert(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = confirm('Delete this paragraph permanently? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/v1/books/paragraphs/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadOverlengthParagraphs();
      } else {
        const data = await response.json();
        alert(`Delete failed: ${data.message}`);
      }
    } catch (err) {
      alert(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const updateCursorPosition = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading overlength paragraphs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800 font-semibold">Error</div>
        <div className="text-red-600">{error}</div>
        <button
          onClick={loadOverlengthParagraphs}
          className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="overlength-paragraph-editor max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Overlength Paragraph Editor</h2>
        <p className="text-gray-600">
          Found {paragraphs.length} paragraph{paragraphs.length !== 1 ? 's' : ''} exceeding 1000 characters
        </p>
        <button
          onClick={loadOverlengthParagraphs}
          className="mt-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
        >
          Refresh
        </button>
      </div>

      {paragraphs.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <div className="text-green-800 font-semibold mb-2">All Clear!</div>
          <div className="text-green-600">No overlength paragraphs found.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {paragraphs.map((para) => (
            <div
              key={para.id}
              className="border border-gray-300 rounded-lg p-4 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-gray-700">Paragraph #{para.id}</span>
                  <span className="text-sm text-gray-500">
                    Book: {para.book_id} | Index: {para.paragraph_index}
                  </span>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    para.char_count > 2000 ? 'bg-red-100 text-red-800' :
                    para.char_count > 1500 ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {para.char_count} chars
                  </span>
                </div>
                
                {editingId !== para.id && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(para)}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(para.id)}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {editingId === para.id ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Character count: {editContent.length} | Cursor position: {cursorPosition}
                    </span>
                    <span className={`text-sm font-medium ${
                      editContent.length > 1000 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {editContent.length > 1000 ? 'Still overlength' : 'Within limit'}
                    </span>
                  </div>
                  
                  <textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyUp={updateCursorPosition}
                    onClick={updateCursorPosition}
                    className="w-full h-64 p-3 border border-gray-300 rounded font-mono text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  
                  <div className="mt-3 flex space-x-2">
                    <button
                      onClick={() => handleSave(para.id)}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => handleSplitAtCursor(para.id)}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded"
                    >
                      Split at Cursor
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <div className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                    {para.content.substring(0, 500)}
                    {para.content.length > 500 && (
                      <span className="text-gray-400">... (truncated, click Edit to see full content)</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OverlengthParagraphEditor;
/**
 * Overlength Paragraph Editor
 * 
 * Provides UI for manually editing/splitting paragraphs that exceed 1000 characters.
 * Features:
 * - List all overlength paragraphs with character counts
 * - Edit paragraph content directly
 * - Split paragraphs at cursor position
 * - Real-time character count indicator
 * - Bulk operations support
 */

import React, { useState, useEffect, useRef } from 'react';

interface OverlengthParagraph {
  id: number;
  book_id: string;
  paragraph_index: number;
  content: string;
  char_count: number;
  meta: any;
  created_at: string | null;
}

interface OverlengthParagraphEditorProps {
  bookId?: string;
}

export const OverlengthParagraphEditor: React.FC<OverlengthParagraphEditorProps> = ({ bookId }) => {
  const [paragraphs, setParagraphs] = useState<OverlengthParagraph[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadOverlengthParagraphs();
  }, [bookId]);

  const loadOverlengthParagraphs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (bookId) params.append('book_id', bookId);
      params.append('limit', '100');
      
      const response = await fetch(`/api/v1/books/paragraphs/overlength?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setParagraphs(data.paragraphs || []);
      } else {
        setError(data.message || 'Failed to load overlength paragraphs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (para: OverlengthParagraph) => {
    setEditingId(para.id);
    setEditContent(para.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSave = async (id: number) => {
    try {
      const response = await fetch(`/api/v1/books/paragraphs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent,
          clear_overlength_flag: true
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Refresh list
        await loadOverlengthParagraphs();
        setEditingId(null);
        setEditContent('');
      } else {
        alert(`Save failed: ${data.message}`);
      }
    } catch (err) {
      alert(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSplitAtCursor = async (id: number) => {
    if (!textareaRef.current) return;
    
    const splitPos = textareaRef.current.selectionStart;
    
    if (splitPos <= 0 || splitPos >= editContent.length) {
      alert('Please place cursor at desired split position');
      return;
    }
    
    const confirmed = confirm(
      `Split paragraph at position ${splitPos}?\n\n` +
      `First part (${splitPos} chars): "${editContent.substring(0, Math.min(splitPos, 50))}..."\n\n` +
      `Second part (${editContent.length - splitPos} chars): "${editContent.substring(splitPos, Math.min(splitPos + 50, editContent.length))}..."`
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/v1/books/paragraphs/${id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          split_position: splitPos,
          insert_separator: true
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`Split successful! Created new paragraph #${data.new_id}`);
        await loadOverlengthParagraphs();
        setEditingId(null);
        setEditContent('');
      } else {
        alert(`Split failed: ${data.message}`);
      }
    } catch (err) {
      alert(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = confirm('Delete this paragraph permanently? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/v1/books/paragraphs/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await loadOverlengthParagraphs();
      } else {
        const data = await response.json();
        alert(`Delete failed: ${data.message}`);
      }
    } catch (err) {
      alert(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const updateCursorPosition = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">Loading overlength paragraphs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800 font-semibold">Error</div>
        <div className="text-red-600">{error}</div>
        <button
          onClick={loadOverlengthParagraphs}
          className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="overlength-paragraph-editor max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Overlength Paragraph Editor</h2>
        <p className="text-gray-600">
          Found {paragraphs.length} paragraph{paragraphs.length !== 1 ? 's' : ''} exceeding 1000 characters
        </p>
        <button
          onClick={loadOverlengthParagraphs}
          className="mt-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
        >
          Refresh
        </button>
      </div>

      {paragraphs.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <div className="text-green-800 font-semibold mb-2">All Clear!</div>
          <div className="text-green-600">No overlength paragraphs found.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {paragraphs.map((para) => (
            <div
              key={para.id}
              className="border border-gray-300 rounded-lg p-4 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-gray-700">Paragraph #{para.id}</span>
                  <span className="text-sm text-gray-500">
                    Book: {para.book_id} | Index: {para.paragraph_index}
                  </span>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    para.char_count > 2000 ? 'bg-red-100 text-red-800' :
                    para.char_count > 1500 ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {para.char_count} chars
                  </span>
                </div>
                
                {editingId !== para.id && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(para)}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(para.id)}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {editingId === para.id ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      Character count: {editContent.length} | Cursor position: {cursorPosition}
                    </span>
                    <span className={`text-sm font-medium ${
                      editContent.length > 1000 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {editContent.length > 1000 ? 'Still overlength' : 'Within limit'}
                    </span>
                  </div>
                  
                  <textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyUp={updateCursorPosition}
                    onClick={updateCursorPosition}
                    className="w-full h-64 p-3 border border-gray-300 rounded font-mono text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  
                  <div className="mt-3 flex space-x-2">
                    <button
                      onClick={() => handleSave(para.id)}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => handleSplitAtCursor(para.id)}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded"
                    >
                      Split at Cursor
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <div className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                    {para.content.substring(0, 500)}
                    {para.content.length > 500 && (
                      <span className="text-gray-400">... (truncated, click Edit to see full content)</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OverlengthParagraphEditor;
