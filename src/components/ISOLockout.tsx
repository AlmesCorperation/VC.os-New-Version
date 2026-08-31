import React from 'react';
import { Download, AlertTriangle, Cpu, Shield } from 'lucide-react';
import { motion } from 'motion/react';

interface ISOLockoutProps {
  onDownload: () => void;
  isCompiling: boolean;
  progress: number;
}

export const ISOLockout: React.FC<ISOLockoutProps> = ({ onDownload, isCompiling, progress }) => {
  return (
    <div className="fixed inset-0 bg-[#000080] flex items-center justify-center p-4 z-[9999] font-mono text-white">
      <div className="max-w-2xl w-full border-4 border-white p-8 bg-[#000080] shadow-[10px_10px_0px_0px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4 mb-8 border-b-4 border-white pb-4">
          <AlertTriangle size={48} className="text-yellow-400" />
          <h1 className="text-4xl font-black tracking-tighter">SYSTEM_HALT: BROWSER_DETECTED</h1>
        </div>

        <div className="space-y-6 text-xl leading-relaxed">
          <p className="bg-white text-[#000080] px-2 inline-block font-bold">
            ERROR_CODE: 0xDEADBEEF
          </p>
          
          <p>
            VC.os has detected a web browser environment. For security and performance reasons, 
            the full operating system experience is restricted to native hardware execution.
          </p>

          <div className="bg-black/20 p-4 border-2 border-dashed border-white/50">
            <p className="text-yellow-200 font-bold mb-2">"The ISO is the only place for this right now."</p>
            <p className="text-sm opacity-80">
              Native execution ensures Ring 0 privilege access, direct IDT management, 
              and hardware-level memory protection that browsers cannot provide.
            </p>
          </div>

          {!isCompiling ? (
            <button
              onClick={onDownload}
              className="w-full bg-white text-[#000080] py-4 px-8 text-2xl font-black flex items-center justify-center gap-4 hover:bg-yellow-400 transition-colors group"
            >
              <Download className="group-hover:bounce" />
              DOWNLOAD_VC_OS.ISO
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between font-bold">
                <span>COMPILING_SYSTEM_IMAGE...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-8 border-4 border-white p-1">
                <motion.div 
                  className="h-full bg-yellow-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs opacity-60">
                <span>{'>'} LINKING KERNEL.SYS</span>
                <span>{'>'} BUILDING IDT_TABLE</span>
                <span>{'>'} PACKING VFS_IMAGE</span>
                <span>{'>'} GENERATING ISO9660_PVD</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 flex justify-between items-center text-xs opacity-50 border-t-2 border-white/20 pt-4">
          <div className="flex items-center gap-2">
            <Cpu size={14} />
            <span>VC.os v1.0.4-STABLE</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield size={14} />
            <span>SECURE_BOOT_ENABLED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
