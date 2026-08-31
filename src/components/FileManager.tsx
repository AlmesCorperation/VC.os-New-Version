import React, { useState, useEffect, useRef } from 'react';
import { vfs } from '../services/vfs';
import { kernel } from '../services/kernel';

export const FileManager: React.FC<{ onOpenFile: (name: string) => void, onCrash?: () => void }> = ({ onOpenFile, onCrash }) => {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFiles(vfs.ls());
  }, []);

  const handleFileClick = (file: string) => {
    setSelectedFile(file);
  };

  const handleFileDoubleClick = (file: string) => {
    kernel.emitEvent('SYSCALL', `SYS_EXECVE: ${file}`);
    kernel.executeTask('VFS_READ', 2);
    onOpenFile(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!files.length) return;
    
    const currentIndex = selectedFile ? files.indexOf(selectedFile) : -1;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < files.length - 1 ? currentIndex + 1 : currentIndex;
      setSelectedFile(files[nextIndex]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      setSelectedFile(files[prevIndex]);
    } else if (e.key === 'Enter' && selectedFile) {
      e.preventDefault();
      handleFileDoubleClick(selectedFile);
    }
  };

  const handleInstallFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        vfs.write(file.name, content);
        setFiles(vfs.ls());
      } catch (err: any) {
        alert(err.message);
      }
    };
    
    // Read text files as text, others as data URL
    if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.cpp') || file.name.endsWith('.md')) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div 
      className="flex flex-col h-full bg-white text-black font-mono text-sm select-none outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => setActiveMenu(null)}
    >
      {/* Menu Bar */}
      <div className="flex border-b-2 border-black bg-white">
        {['File', 'View', 'Special'].map(menu => (
          <div key={menu} className="relative">
            <div 
              className={`px-3 py-1 cursor-pointer ${activeMenu === menu ? 'bg-black text-white' : 'hover:bg-black hover:text-white'}`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenu(activeMenu === menu ? null : menu);
              }}
            >
              {menu}
            </div>
            {activeMenu === menu && (
              <div className="absolute top-full left-0 bg-white border-2 border-black shadow-md z-10 min-w-[120px]">
                {menu === 'File' && (
                  <>
                    <div className="px-3 py-1 hover:bg-black hover:text-white cursor-pointer" onClick={() => selectedFile && onOpenFile(selectedFile)}>Open</div>
                    <div className="px-3 py-1 hover:bg-black hover:text-white cursor-pointer" onClick={() => fileInputRef.current?.click()}>Install File...</div>
                    <div className="px-3 py-1 hover:bg-black hover:text-white cursor-pointer" onClick={() => {
                      if (selectedFile) {
                        try {
                          vfs.rm(selectedFile);
                          setFiles(vfs.ls());
                          setSelectedFile(null);
                        } catch (err: any) {
                          if (err.message.includes('CRITICAL_FILE_REMOVED') && onCrash) {
                            onCrash();
                          } else {
                            alert(err.message);
                          }
                        }
                      }
                    }}>Delete</div>
                  </>
                )}
                {menu === 'View' && (
                  <>
                    <div className="px-3 py-1 hover:bg-black hover:text-white cursor-pointer">Short</div>
                    <div className="px-3 py-1 hover:bg-black hover:text-white cursor-pointer">Long</div>
                  </>
                )}
                {menu === 'Special' && (
                  <div className="px-3 py-1 hover:bg-black hover:text-white cursor-pointer" onClick={() => setFiles(vfs.ls())}>Refresh</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Drive and Path */}
      <div className="flex items-center gap-4 p-2 border-b-2 border-black">
        <div className="flex gap-2">
          <span className="font-bold cursor-pointer hover:bg-black hover:text-white px-1">A</span>
          <span className="font-bold cursor-pointer hover:bg-black hover:text-white px-1">B</span>
          <span className="font-bold bg-black text-white px-1">C</span>
        </div>
        <div className="font-bold flex-1">
          C:\VC_OS\
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 p-2 overflow-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1">
          {files.map(file => {
            const isSelected = selectedFile === file;
            const fileData = vfs.getFile(file);
            const isDir = fileData?.type === 'dir';
            
            return (
              <div 
                key={file}
                className={`flex items-center gap-2 px-1 cursor-pointer ${isSelected ? 'bg-black text-white' : 'hover:bg-gray-200'}`}
                onClick={() => handleFileClick(file)}
                onDoubleClick={() => handleFileDoubleClick(file)}
              >
                <span className="w-4 text-center">{isDir ? '📁' : '📄'}</span>
                <span className="truncate">{file}</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Status Bar */}
      <div className="p-1 border-t-2 border-black text-xs flex justify-between">
        <div>
          {selectedFile ? `${selectedFile} - ${vfs.cat(selectedFile).length} bytes` : `${files.length} files`}
        </div>
        <div>
          Free: {(vfs.getFreeMemory() / (1024 * 1024)).toFixed(2)} MB
        </div>
      </div>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleInstallFile} 
      />
    </div>
  );
};
