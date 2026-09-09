import React, { useState, useEffect, useCallback } from 'react';
import { usePIT } from '../hooks/useAudio';

export const CalculatorApp: React.FC = () => {
  const { playTone } = usePIT();

  const [display, setDisplay] = useState<string>('0');
  const [equation, setEquation] = useState<string>('');
  const [memory, setMemory] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [activeOperator, setActiveOperator] = useState<string | null>(null);
  const [storedValue, setStoredValue] = useState<number | null>(null);

  // Play realistic mechanical calculator key click beep
  const playClick = (freq = 700) => {
    try {
      playTone(freq, 0.03, 'square');
    } catch (e) {
      // Fallback
    }
  };

  const handleClear = useCallback(() => {
    playClick(500);
    setDisplay('0');
    setEquation('');
    setStoredValue(null);
    setActiveOperator(null);
    setIsFinished(false);
  }, []);

  const handleBackspace = useCallback(() => {
    playClick(600);
    if (isFinished) {
      setEquation('');
      return;
    }
    setDisplay(prev => {
      if (prev.length <= 1 || prev === 'Error') return '0';
      return prev.slice(0, -1);
    });
  }, [isFinished]);

  const handleDigit = useCallback((digit: string) => {
    playClick(800 + parseInt(digit, 10) * 20);
    setDisplay(prev => {
      if (prev === '0' || isFinished || prev === 'Error') {
        setIsFinished(false);
        return digit;
      }
      return prev + digit;
    });
  }, [isFinished]);

  const handleDecimal = useCallback(() => {
    playClick(850);
    setDisplay(prev => {
      if (isFinished || prev === 'Error') {
        setIsFinished(false);
        return '0.';
      }
      if (prev.includes('.')) return prev;
      return prev + '.';
    });
  }, [isFinished]);

  const handleOperator = useCallback((op: string) => {
    playClick(1000);
    const current = parseFloat(display);
    if (isNaN(current)) return;

    if (storedValue !== null && activeOperator) {
      // Calculate intermediate result
      let result = 0;
      switch (activeOperator) {
        case '+': result = storedValue + current; break;
        case '-': result = storedValue - current; break;
        case '*': result = storedValue * current; break;
        case '/': result = current !== 0 ? storedValue / current : NaN; break;
      }
      if (isNaN(result)) {
        setDisplay('Error');
        setStoredValue(null);
        setActiveOperator(null);
        return;
      }
      setDisplay(String(result));
      setStoredValue(result);
    } else {
      setStoredValue(current);
    }

    setActiveOperator(op);
    setEquation(`${current} ${op}`);
    setIsFinished(true);
  }, [display, storedValue, activeOperator]);

  const handleEquals = useCallback(() => {
    playClick(1200);
    const current = parseFloat(display);
    if (isNaN(current) || storedValue === null || !activeOperator) return;

    let result = 0;
    switch (activeOperator) {
      case '+': result = storedValue + current; break;
      case '-': result = storedValue - current; break;
      case '*': result = storedValue * current; break;
      case '/': result = current !== 0 ? storedValue / current : NaN; break;
    }

    if (isNaN(result)) {
      setDisplay('Error');
    } else {
      // Format response nicely to handle precision issues
      const formatted = Number(result.toPrecision(12)).toString();
      setDisplay(formatted);
      setEquation('');
    }
    setStoredValue(null);
    setActiveOperator(null);
    setIsFinished(true);
  }, [display, storedValue, activeOperator]);

  const handleToggleSign = useCallback(() => {
    playClick(900);
    setDisplay(prev => {
      if (prev === '0' || prev === 'Error') return prev;
      if (prev.startsWith('-')) return prev.slice(1);
      return '-' + prev;
    });
  }, []);

  const handlePercent = useCallback(() => {
    playClick(950);
    setDisplay(prev => {
      const val = parseFloat(prev);
      if (isNaN(val)) return 'Error';
      return String(val / 100);
    });
  }, []);

  const handleSquare = useCallback(() => {
    playClick(1050);
    setDisplay(prev => {
      const val = parseFloat(prev);
      if (isNaN(val)) return 'Error';
      return String(val * val);
    });
  }, []);

  const handleSqrt = useCallback(() => {
    playClick(1100);
    setDisplay(prev => {
      const val = parseFloat(prev);
      if (isNaN(val) || val < 0) return 'Error';
      return String(Math.sqrt(val));
    });
  }, []);

  const handleReciprocal = useCallback(() => {
    playClick(1150);
    setDisplay(prev => {
      const val = parseFloat(prev);
      if (isNaN(val) || val === 0) return 'Error';
      return String(1 / val);
    });
  }, []);

  // Memory Actions
  const handleMemory = useCallback((action: string) => {
    playClick(1300);
    const val = parseFloat(display);
    if (isNaN(val)) return;

    switch (action) {
      case 'MC':
        setMemory(0);
        break;
      case 'MR':
        setDisplay(String(memory));
        setIsFinished(true);
        break;
      case 'M+':
        setMemory(prev => prev + val);
        setIsFinished(true);
        break;
      case 'M-':
        setMemory(prev => prev - val);
        setIsFinished(true);
        break;
      case 'MS':
        setMemory(val);
        setIsFinished(true);
        break;
    }
  }, [display, memory]);

  // Physical Keyboard Hooks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key >= '0' && key <= '9') {
        e.preventDefault();
        handleDigit(key);
      } else if (key === '.') {
        e.preventDefault();
        handleDecimal();
      } else if (key === '+' || key === '-' || key === '*' || key === '/') {
        e.preventDefault();
        handleOperator(key);
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (key === '%') {
        e.preventDefault();
        handlePercent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleDecimal, handleOperator, handleEquals, handleClear, handleBackspace, handlePercent]);

  return (
    <div className="flex flex-col h-full bg-[#f0ede6] text-[#2c2a29] p-3 font-mono leading-none select-none border-t border-l border-white shadow-[inset_1px_1px_0px_#fff,2px_2px_4px_rgba(0,0,0,0.25)] select-none">
      {/* LCD Simulated Backlight Screen */}
      <div className="relative bg-[#a4bd96] border-2 border-t-[#6e7d66] border-l-[#6e7d66] border-r-white border-b-white px-2 py-3 rounded mb-3 text-right overflow-hidden shadow-inner">
        {/* CRT Scanline Filter effect overlay */}
        <div className="absolute inset-0 bg-scanlines opacity-5 pointer-events-none" />
        <div className="text-[10px] text-[#424f3c] h-3 uppercase tracking-wider font-bold mb-1 flex justify-between">
          <span>{equation}</span>
          <span>{memory !== 0 ? 'M' : ''}</span>
        </div>
        <div className="text-2xl font-bold font-mono text-[#1a2416] tracking-tight whitespace-nowrap overflow-hidden">
          {display}
        </div>
      </div>

      {/* Memory Control Row */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {['MC', 'MR', 'M+', 'M-', 'MS'].map(btn => (
          <button
            key={btn}
            onClick={() => handleMemory(btn)}
            className="py-1.5 text-[10px] font-bold text-neutral-700 bg-[#e2dec9] border border-t-white border-l-white border-r-[#9c9a89] border-b-[#9c9a89] active:border-[#9c9a89] active:border-t-black active:border-l-black hover:bg-[#eae6d2] rounded-sm shadow-sm transition-all uppercase"
          >
            {btn}
          </button>
        ))}
      </div>

      {/* Main Scientific / Utility Buttons */}
      <div className="grid grid-cols-4 gap-1.5 mb-2.5">
        <button
          onClick={handleClear}
          className="py-2.5 text-xs font-bold text-red-700 bg-[#e5cfc8] border border-t-white border-l-white border-r-[#b0968f] border-b-[#b0968f] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-[#ebdad4]"
        >
          C
        </button>
        <button
          onClick={handleBackspace}
          className="py-2.5 text-xs font-bold text-neutral-800 bg-[#e3dfd3] border border-t-white border-l-white border-r-[#a8a496] border-b-[#a8a496] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-[#eae6db]"
        >
          CE
        </button>
        <button
          onClick={handleToggleSign}
          className="py-2.5 text-xs font-bold text-neutral-800 bg-[#e3dfd3] border border-t-white border-l-white border-r-[#a8a496] border-b-[#a8a496] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-[#eae6db]"
        >
          +/-
        </button>
        <button
          onClick={() => handleOperator('/')}
          className={`py-2.5 text-xs font-black border rounded-sm shadow-sm transition-all ${
            activeOperator === '/'
              ? 'bg-blue-600 text-white border-t-black border-l-black'
              : 'bg-[#cfd2d6] text-blue-900 border-t-white border-l-white border-r-[#929599] border-b-[#929599] hover:bg-[#d9dcde]'
          }`}
        >
          /
        </button>
      </div>

      {/* 3x3 Keypad and Basic Operations Block */}
      <div className="grid grid-cols-4 gap-1.5 flex-1">
        {/* Col 1-3 digits, Col 4 Operator */}
        <button
          onClick={() => handleDigit('7')}
          className="py-3 text-sm font-bold bg-[#faf8f2] border border-t-white border-l-white border-r-[#c2bfb8] border-b-[#c2bfb8] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-white"
        >
          7
        </button>
        <button
          onClick={() => handleDigit('8')}
          className="py-3 text-sm font-bold bg-[#faf8f2] border border-t-white border-l-white border-r-[#c2bfb8] border-b-[#c2bfb8] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-white"
        >
          8
        </button>
        <button
          onClick={() => handleDigit('9')}
          className="py-3 text-sm font-bold bg-[#faf8f2] border border-t-white border-l-white border-r-[#c2bfb8] border-b-[#c2bfb8] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-white"
        >
          9
        </button>
        <button
          onClick={() => handleOperator('*')}
          className={`py-3 text-xs font-black border rounded-sm shadow-sm transition-all ${
            activeOperator === '*'
              ? 'bg-blue-600 text-white border-t-black border-l-black'
              : 'bg-[#cfd2d6] text-blue-900 border-t-white border-l-white border-r-[#929599] border-b-[#929599] hover:bg-[#d9dcde]'
          }`}
        >
          *
        </button>

        <button
          onClick={() => handleDigit('4')}
          className="py-3 text-sm font-bold bg-[#faf8f2] border border-t-white border-l-white border-r-[#c2bfb8] border-b-[#c2bfb8] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-white"
        >
          4
        </button>
        <button
          onClick={() => handleDigit('5')}
          className="py-3 text-sm font-bold bg-[#faf8f2] border border-t-white border-l-white border-r-[#c2bfb8] border-b-[#c2bfb8] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-white"
        >
          5
        </button>
        <button
          onClick={() => handleDigit('6')}
          className="py-3 text-sm font-bold bg-[#faf8f2] border border-t-white border-l-white border-r-[#c2bfb8] border-b-[#c2bfb8] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-white"
        >
          6
        </button>
        <button
          onClick={() => handleOperator('-')}
          className={`py-3 text-xs font-black border rounded-sm shadow-sm transition-all ${
            activeOperator === '-'
              ? 'bg-blue-600 text-white border-t-black border-l-black'
              : 'bg-[#cfd2d6] text-blue-900 border-t-white border-l-white border-r-[#929599] border-b-[#929599] hover:bg-[#d9dcde]'
          }`}
        >
          -
        </button>

        <button
          onClick={() => handleDigit('1')}
          className="py-3 text-sm font-bold bg-[#faf8f2] border border-t-white border-l-white border-r-[#c2bfb8] border-b-[#c2bfb8] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-white"
        >
          1
        </button>
        <button
          onClick={() => handleDigit('2')}
          className="py-3 text-sm font-bold bg-[#faf8f2] border border-t-white border-l-white border-r-[#c2bfb8] border-b-[#c2bfb8] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-white"
        >
          2
        </button>
        <button
          onClick={() => handleDigit('3')}
          className="py-3 text-sm font-bold bg-[#faf8f2] border border-t-white border-l-white border-r-[#c2bfb8] border-b-[#c2bfb8] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-white"
        >
          3
        </button>
        <button
          onClick={() => handleOperator('+')}
          className={`py-3 text-xs font-black border rounded-sm shadow-sm transition-all ${
            activeOperator === '+'
              ? 'bg-blue-600 text-white border-t-black border-l-black'
              : 'bg-[#cfd2d6] text-blue-900 border-t-white border-l-white border-r-[#929599] border-b-[#929599] hover:bg-[#d9dcde]'
          }`}
        >
          +
        </button>

        {/* Scientific Functions row (sq, sqrt, 1/x) and Equals */}
        <button
          onClick={() => handleDigit('0')}
          className="py-3 text-sm font-bold bg-[#faf8f2] border border-t-white border-l-white border-r-[#c2bfb8] border-b-[#c2bfb8] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-white"
        >
          0
        </button>
        <button
          onClick={handleDecimal}
          className="py-3 text-sm font-bold bg-[#faf8f2] border border-t-white border-l-white border-r-[#c2bfb8] border-b-[#c2bfb8] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-white"
        >
          .
        </button>
        <button
          onClick={handleSqrt}
          className="py-3 text-xs font-bold bg-[#e3dfd3] border border-t-white border-l-white border-r-[#a8a496] border-b-[#a8a496] active:border-t-black active:border-l-black rounded-sm shadow-sm hover:bg-[#eae6db]"
        >
          √x
        </button>
        <button
          onClick={handleEquals}
          className="py-3 text-sm font-black bg-[#e98f62] border border-t-white border-l-white border-r-[#ad5a2c] border-b-[#ad5a2c] active:border-t-black active:border-l-black text-[#5c2405] rounded-sm shadow-sm hover:bg-[#efa077]"
        >
          =
        </button>
      </div>

      <div className="flex justify-between items-center text-[8px] text-neutral-400 mt-3 border-t border-[#dfdbd1] pt-2">
        <span>VCOS CALC-16</span>
        <span>INTEGRATED SYSTEM SPEAKER beep</span>
      </div>
    </div>
  );
};
