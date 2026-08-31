import React from 'react';
import { UserCircle } from 'lucide-react';

export const GuestBlocker: React.FC = () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-win95-gray p-4 text-center border-inset">
    <UserCircle size={64} className="text-win95-dark-gray mb-4" />
    <h2 className="text-lg font-bold mb-2 uppercase">log in to use online features!</h2>
    <p className="text-sm text-gray-600">Guest accounts cannot access network resources.</p>
  </div>
);
