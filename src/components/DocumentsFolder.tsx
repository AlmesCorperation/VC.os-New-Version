import React, { useState } from 'react';
import { Folder, FileText, File } from 'lucide-react';
import { vfs } from '../services/vfs';
import { kernel } from '../services/kernel';

export const DocumentsFolder: React.FC<{ onOpenFile: (name: string) => void }> = ({ onOpenFile }) => {
  const files = vfs.ls();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleDoubleClick = (file: string) => {
    kernel.emitEvent('SYSCALL', `SYS_OPEN (${file})`);
    onOpenFile(file);
  };

  return (
    <div className="h-full flex flex-col font-sans text-[11px] bg-win95-gray">
      <div className="flex items-center gap-2 p-1 border-b border-win95-dark-gray bg-zinc-200">
        <Folder size={16} className="text-yellow-600" />
        <span className="font-bold">C:\Documents</span>
      </div>
      
      <div className="flex-1 border-inset bg-white overflow-y-auto p-2 grid grid-cols-4 gap-4 content-start">
        {files.map((file, i) => (
          <div 
            key={i} 
            className={`flex flex-col items-center gap-1 p-2 cursor-pointer text-center ${selectedFile === file ? 'bg-win95-blue text-white' : 'hover:bg-zinc-100'}`}
            onClick={() => setSelectedFile(file)}
            onDoubleClick={() => handleDoubleClick(file)}
          >
            {file.endsWith('.txt') ? (
              <FileText size={32} className={selectedFile === file ? 'text-white' : 'text-blue-600'} />
            ) : file.endsWith('.cpp') ? (
              <File size={32} className={selectedFile === file ? 'text-white' : 'text-green-600'} />
            ) : (
              <File size={32} className={selectedFile === file ? 'text-white' : 'text-gray-600'} />
            )}
            <span className="break-all text-[10px] leading-tight mt-1">{file}</span>
          </div>
        ))}
      </div>
      
      <div className="p-1 border-t border-win95-gray bg-zinc-200 text-win95-dark-gray flex justify-between">
        <span>{files.length} object(s)</span>
        {selectedFile && <span>{vfs.cat(selectedFile).length} bytes</span>}
      </div>
    </div>
  );
};
