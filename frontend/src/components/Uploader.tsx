import { useRef, useState } from 'react';

export const DEFAULT_PROMPT =
  'Read this aloud clearly at a natural, calm pace, like narrating a book to a listener.';

interface Props {
  disabled: boolean;
  onFile: (file: File, prompt: string, pageRange: string) => void;
}

const PAGE_SPEC_RE = /^\s*(\d+(\s*[-–]\s*\d+)?)(\s*,\s*\d+(\s*[-–]\s*\d+)?)*\s*$/;

export default function Uploader({ disabled, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [pageRange, setPageRange] = useState('');

  const pageRangeValid = pageRange.trim() === '' || PAGE_SPEC_RE.test(pageRange);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please choose a PDF file.');
      return;
    }
    if (!pageRangeValid) {
      alert('Pages must look like: 2, 1-5, or 1,3,5-7 (or leave blank for all).');
      return;
    }
    onFile(file, prompt, pageRange.trim());
  };

  return (
    <div className="upload-panel">
      <label className="field">
        <span className="field-label">Narration style</span>
        <textarea
          className="prompt-input"
          rows={2}
          value={prompt}
          disabled={disabled}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Read in a warm, calm storytelling tone"
        />
        <span className="field-hint">
          Steers the Gemini voice's tone &amp; delivery. Applied to the whole document.
        </span>
      </label>

      <label className="field">
        <span className="field-label">Pages</span>
        <input
          className={`prompt-input${pageRangeValid ? '' : ' invalid'}`}
          type="text"
          value={pageRange}
          disabled={disabled}
          onChange={(e) => setPageRange(e.target.value)}
          placeholder="All pages — or e.g. 2, 1-5, 1,3,5-7"
        />
        <span className="field-hint">
          {pageRangeValid
            ? 'Leave blank to convert the whole PDF, or pick specific pages / a range.'
            : 'Use a single page (2), a range (1-5), or a list (1,3,5-7).'}
        </span>
      </label>

      <div
        className={`dropzone${dragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) pick(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => pick(e.target.files)}
        />
        <div className="dz-icon">📄→🔊</div>
        <p className="dz-title">Drop a PDF here, or click to choose</p>
        <p className="dz-sub">English, Telugu, Tamil, Hindi or mixed — we detect it automatically.</p>
      </div>
    </div>
  );
}
