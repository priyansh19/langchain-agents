import { useState } from 'react';
import { Copy, Check, Download, X } from 'lucide-react';

interface Props {
  content: string;
  lang: string;
  onClose: () => void;
}

export function ArtifactPanel({ content, lang, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function download() {
    const ext = lang || 'txt';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `artifact.${ext}`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="artifact-panel">
      <div className="artifact-header">
        <span className="artifact-lang">{lang || 'code'}</span>
        <div className="artifact-actions">
          <button className="artifact-btn" onClick={copy}>{copied ? <><Check size={11}/> Copied</> : <><Copy size={11}/> Copy</>}</button>
          <button className="artifact-btn" onClick={download}><Download size={11}/> Download</button>
          <button className="artifact-btn artifact-btn--close" onClick={onClose}><X size={12}/></button>
        </div>
      </div>
      <div className="artifact-body">
        <pre className="artifact-pre"><code>{content}</code></pre>
      </div>
    </div>
  );
}
