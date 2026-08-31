import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCcw, Lock } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

const FAKE_NETWORKS = [
  { id: 'vc-net', name: 'VC_PUBLIC_WIFI', signal: 4, secure: false },
  { id: 'sys-core', name: 'SYSTEM_CORE_5G', signal: 3, secure: true },
  { id: 'guest', name: 'Guest_Network', signal: 2, secure: false },
  { id: 'hidden', name: 'Hidden Network', signal: 1, secure: true },
];

export const WifiManager: React.FC = () => {
  const { isWifiConnected, setWifiConnected } = useSettings();
  const [scanning, setScanning] = useState(false);
  const [connectingTo, setConnectingTo] = useState<string | null>(null);
  const [selectedNet, setSelectedNet] = useState<string | null>(null);

  const handleConnect = (id: string) => {
    setConnectingTo(id);
    setTimeout(() => {
      setWifiConnected(true);
      setConnectingTo(null);
    }, 2000);
  };

  const handleDisconnect = () => {
    setWifiConnected(false);
    setSelectedNet(null);
  };

  const scan = () => {
    setScanning(true);
    setTimeout(() => setScanning(false), 1500);
  };

  return (
    <div className="w-full h-full bg-win95-gray p-4 font-docs flex flex-col">
      <div className="flex items-center gap-3 mb-4 border-b border-win95-dark-gray pb-2">
        {isWifiConnected ? <Wifi size={32} className="text-green-600" /> : <WifiOff size={32} className="text-red-600" />}
        <div>
          <h2 className="text-xl font-bold">Wireless Network Connection</h2>
          <p className="text-sm">{isWifiConnected ? 'Connected to Internet' : 'Not connected'}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-2">
        <span className="font-bold">Available networks:</span>
        <button 
          onClick={scan}
          disabled={scanning}
          className="px-2 py-1 bg-win95-gray border-outset text-xs flex items-center gap-1 active:border-inset disabled:opacity-50"
        >
          <RefreshCcw size={12} className={scanning ? 'animate-spin' : ''} />
          Refresh list
        </button>
      </div>

      <div className="border-inset bg-white flex-1 overflow-y-auto mb-4 p-1">
        {scanning ? (
          <div className="p-4 flex text-gray-500 items-center justify-center h-full">
            Scanning for wireless networks...
          </div>
        ) : (
          FAKE_NETWORKS.map(net => (
            <div 
              key={net.id}
              onClick={() => !isWifiConnected && setSelectedNet(net.id)}
              className={`p-2 border-b border-gray-200 flex items-center justify-between cursor-pointer ${selectedNet === net.id ? 'bg-[#000080] text-white' : 'hover:bg-blue-50'} ${isWifiConnected ? 'opacity-70 pointer-events-none' : ''}`}
            >
              <div className="flex items-center gap-2">
                <Wifi size={16} className={selectedNet === net.id ? 'text-white' : 'text-gray-700'} />
                <span>{net.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {net.secure && <Lock size={12} className={selectedNet === net.id ? 'text-white' : 'text-gray-500'} />}
                <div className="flex gap-[1px] h-3 items-end">
                  {[1, 2, 3, 4].map(bar => (
                    <div 
                      key={bar} 
                      className={`w-1 ${bar <= net.signal ? (selectedNet === net.id ? 'bg-white' : 'bg-green-500') : 'bg-gray-300'}`}
                      style={{ height: `${bar * 25}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-end gap-2">
        {isWifiConnected ? (
          <button 
            onClick={handleDisconnect}
            className="px-4 py-1 bg-win95-gray border-outset min-w-[100px] active:border-inset font-bold"
          >
            Disconnect
          </button>
        ) : (
          <button 
            onClick={() => selectedNet && handleConnect(selectedNet)}
            disabled={!selectedNet || connectingTo !== null}
            className="px-4 py-1 bg-win95-gray border-outset min-w-[100px] active:border-inset font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {connectingTo ? (
              <>
                <RefreshCcw size={12} className="animate-spin" />
                Connecting
              </>
            ) : (
              'Connect'
            )}
          </button>
        )}
      </div>
    </div>
  );
};
