import React, { useState, useEffect } from 'react';
import { vfs } from '../services/vfs';
import { kernel } from '../services/kernel';

export const Notepad: React.FC<{ fileName: string }> = ({ fileName }) => {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const fileContent = vfs.cat(fileName);
      setContent(fileContent);
    } catch (e: any) {
      setError(e.message);
    }
  }, [fileName]);

  const handleSave = () => {
    try {
      vfs.write(fileName, content);
      kernel.emitEvent('SYSCALL', `SYS_WRITE: ${fileName}`);
      kernel.executeTask('VFS_WRITE', 5);
      alert(`Saved ${fileName}`);
    } catch (e: any) {
      alert(`Error saving file: ${e.message}`);
    }
  };

  return (
    <div className="h-full flex flex-col font-sans text-[11px] bg-win95-gray">
      <div className="flex items-center gap-2 p-1 border-b border-win95-dark-gray bg-zinc-200">
        <button className="px-2 py-0.5 hover:bg-win95-blue hover:text-white" onClick={handleSave}>File</button>
        <button className="px-2 py-0.5 hover:bg-win95-blue hover:text-white">Edit</button>
        <button className="px-2 py-0.5 hover:bg-win95-blue hover:text-white">Search</button>
        <button className="px-2 py-0.5 hover:bg-win95-blue hover:text-white">Help</button>
      </div>
      
      <div className="flex-1 border-inset bg-white overflow-hidden relative">
        {error ? (
          <div className="p-4 text-red-600 font-bold">{error}</div>
        ) : (
          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full p-2 outline-none resize-none font-mono text-[12px]"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
};
