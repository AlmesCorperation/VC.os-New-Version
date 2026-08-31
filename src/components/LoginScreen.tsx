import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Monitor } from 'lucide-react';
import { kernel } from '../services/kernel';

export const LoginScreen: React.FC<{ onLogin: (username: string) => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('Keo Doolish');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('vcos_username');
    if (savedUsername !== null) {
      setUsername(savedUsername);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    kernel.emitEvent('SYSCALL', `SYS_LOGIN (${username})`);
    localStorage.setItem('vcos_username', username);
    setIsLoggingIn(true);
    setTimeout(() => onLogin(username), 1500);
  };

  return (
    <div className="fixed inset-0 bg-win95-teal flex items-center justify-center overflow-auto p-3 font-sans">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-[420px] bg-win95-gray border-outset shadow-xl my-auto"
      >
        {/* Header */}
        <div className="h-6 bg-win95-blue flex items-center px-2 m-0.5">
          <span className="text-white font-bold text-[11px]">Welcome to VC.os</span>
        </div>

        <div className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
          {/* Icon */}
          <div className="flex-shrink-0 flex sm:block justify-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-win95-gray border-inset flex items-center justify-center">
              <Monitor size={32} className="text-win95-dark-gray sm:scale-125" />
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div className="text-xs sm:text-sm">
              <p className="font-bold">Type a user name and password to log on to VC.os.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="grid grid-cols-[70px_1fr] sm:grid-cols-[80px_1fr] items-center gap-2">
                <label className="text-[11px] font-bold">User name:</label>
                <input 
                  type="text"
                  className="bg-white border-inset p-1 text-sm outline-none focus:ring-1 focus:ring-win95-blue w-full"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus={!username}
                />
                
                <label className="text-[11px] font-bold">Password:</label>
                <input 
                  type="password"
                  className="bg-white border-inset p-1 text-sm outline-none focus:ring-1 focus:ring-win95-blue w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus={!!username}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="submit"
                  disabled={isLoggingIn || !username.trim()}
                  className="px-5 sm:px-6 py-1.5 sm:py-1 bg-win95-gray border-outset text-xs sm:text-sm font-bold hover:bg-zinc-200 active:border-inset disabled:opacity-50 min-w-[70px] sm:min-w-[80px]"
                >
                  {isLoggingIn ? '...' : 'OK'}
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    kernel.emitEvent('SYSCALL', 'SYS_LOGIN (Guest)');
                    setIsLoggingIn(true);
                    setTimeout(() => onLogin('Guest'), 1000);
                  }}
                  className="px-5 sm:px-6 py-1.5 sm:py-1 bg-win95-gray border-outset text-xs sm:text-sm font-bold hover:bg-zinc-200 active:border-inset min-w-[70px] sm:min-w-[80px]"
                >
                  Guest
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer Info */}
        <div className="p-1 bg-win95-gray border-t border-win95-white/50 text-[9px] text-win95-dark-gray text-right">
          VC.os Service Pack 1
        </div>
      </motion.div>
    </div>
  );
};
