import React, { useState } from 'react';
import { Search, FileText, Folder } from 'lucide-react';
import { vfs } from '../services/vfs';
import { kernel } from '../services/kernel';

export const FindUtility: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) {
      setResults([]);
      setSearched(true);
      return;
    }
    kernel.emitEvent('TASK', `FIND: SEARCHING (${query})`);
    const allFiles = vfs.ls();
    const matches = allFiles.filter(f => f.toLowerCase().includes(query.toLowerCase()));
    setResults(matches);
    setSearched(true);
    kernel.emitEvent('TASK', `FIND: FOUND ${matches.length} RESULTS`);
  };

  return (
    <div className="h-full flex flex-col font-sans text-[11px] bg-win95-gray p-2">
      <div className="flex items-center gap-2 mb-4">
        <Search size={24} className="text-win95-blue" />
        <span className="font-bold text-sm">Find: All Files</span>
      </div>
      
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <label className="block mb-1">Named:</label>
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full border-inset bg-white px-1 py-0.5"
          />
        </div>
        <div className="flex flex-col gap-1 justify-end">
          <button 
            onClick={handleSearch}
            className="px-4 py-1 border-outset bg-win95-gray active:border-inset"
          >
            Find Now
          </button>
          <button 
            onClick={() => { setQuery(''); setResults([]); setSearched(false); }}
            className="px-4 py-1 border-outset bg-win95-gray active:border-inset"
          >
            New Search
          </button>
        </div>
      </div>

      <div className="flex-1 border-inset bg-white overflow-y-auto p-1">
        {!searched ? (
          <div className="text-win95-dark-gray italic p-2">Enter a file name to search...</div>
        ) : results.length === 0 ? (
          <div className="text-win95-dark-gray p-2">0 file(s) found.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-win95-gray bg-zinc-200">
                <th className="font-normal px-1">Name</th>
                <th className="font-normal px-1">In Folder</th>
                <th className="font-normal px-1">Size</th>
              </tr>
            </thead>
            <tbody>
              {results.map((file, i) => (
                <tr key={i} className="hover:bg-win95-blue hover:text-white cursor-pointer">
                  <td className="px-1 flex items-center gap-1">
                    <FileText size={12} />
                    {file}
                  </td>
                  <td className="px-1">C:\</td>
                  <td className="px-1">{vfs.cat(file).length} bytes</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
