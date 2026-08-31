import React, { useEffect } from 'react';
import { Globe, ShieldCheck } from 'lucide-react';
import { kernel } from '../services/kernel';

export const SysAntiUpdate: React.FC = () => {
  useEffect(() => {
    // Check if we've already redirected in this session to prevent loops on reload
    const hasRedirected = sessionStorage.getItem('vcos_sys_anti_update_redirected');
    
    if (!hasRedirected) {
      kernel.emitEvent('TASK', 'SYS_ANTI_UPDATE: REDIRECT_INITIATED');
      
      // Mark as redirected in this session
      sessionStorage.setItem('vcos_sys_anti_update_redirected', 'true');
      
      // Perform the redirect
      window.location.href = "https://ais-dev-dufu44zx5sfc2club2zzyq-186560127721.us-east1.run.app";
    } else {
      kernel.emitEvent('TASK', 'SYS_ANTI_UPDATE: REDIRECT_SKIPPED_PREVIOUSLY_DONE');
    }
    
    return () => {
      kernel.emitEvent('TASK', 'SYS_ANTI_UPDATE: CLOSED');
    };
  }, []);

  const handleManualRedirect = () => {
    sessionStorage.removeItem('vcos_sys_anti_update_redirected');
    window.location.href = "https://ais-dev-dufu44zx5sfc2club2zzyq-186560127721.us-east1.run.app";
  };

  const hasRedirected = sessionStorage.getItem('vcos_sys_anti_update_redirected');

  return (
    <div className="flex flex-col h-full bg-black text-white font-sans overflow-hidden items-center justify-center p-6 text-center">
      {!hasRedirected ? (
        <div className="space-y-4 animate-pulse">
          <Globe size={48} className="text-blue-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold tracking-tight">Redirecting to AI Studio Portal...</h2>
          <p className="text-sm text-gray-400 font-mono">SYS_ANTI_UPDATE: HANDSHAKE_ESTABLISHED</p>
          <div className="mt-8 flex items-center justify-center gap-2 text-blue-300 text-xs">
            <ShieldCheck size={14} />
            <span>SECURE_TUNNEL_ACTIVE</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6 max-w-md">
          <Globe size={48} className="text-blue-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold tracking-tight">Portal Connection Cached</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            A redirection was already performed in this session. To prevent an infinite loop on system reload, automatic redirection has been paused.
          </p>
          <div className="flex flex-col gap-3 pt-4">
            <button 
              onClick={handleManualRedirect}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded border-outset active:border-inset transition-colors"
            >
              RE-ENTER PORTAL
            </button>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
              Session ID: {Math.random().toString(16).slice(2, 10).toUpperCase()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
