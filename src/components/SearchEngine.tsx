import React, { useState, useRef, useEffect } from 'react';
import { Search, Globe, ArrowLeft, ArrowRight, RotateCw, ExternalLink, Shield, WifiOff, Database, Trash2, BookOpen, AlertCircle, Home, Lock, RefreshCw, Layers } from 'lucide-react';
import { kernel } from '../services/kernel';
import { useSettings } from '../hooks/useSettings';

interface IndexedPage {
  url: string;
  title: string;
  snippet: string;
  content: string;
  paragraphs: string[];
  links: { href: string; text: string }[];
  indexedAt: number;
}

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  score: number;
}

interface DdgInstantAnswer {
  heading: string;
  abstractText: string;
  abstractSource: string;
  abstractURL: string;
  image: string;
}

// Default pre-seeded system pages for VC.explorer
const DEFAULT_PAGES: IndexedPage[] = [
  {
    url: "vcos://welcome",
    title: "VC.os Welcome Portal",
    snippet: "Welcome to the Spectrum Gradient and the Vibe Code Operating System. Learn how to navigate the OS, use applications, and write code.",
    content: "Welcome to VC.os, a bare-metal styled virtual operating system. Designed using premium retro styling (resembling classic 90s environments), this system features a custom hybrid kernel, a virtual memory bitmap manager, interrupt monitor, task manager, and custom-made games. Enjoy exploring! Double click desktop icons or use the Start Menu to launch software.",
    paragraphs: [
      "Welcome to VC.os, a bare-metal styled virtual operating system.",
      "Designed using premium retro styling (resembling classic 90s environments), this system features a custom hybrid kernel, a virtual memory bitmap manager, interrupt monitor, task manager, and custom-made games.",
      "Enjoy exploring! Double click desktop icons or use the Start Menu to launch software. Check out the custom Alarm Clock, ISO Compiler, and Game Maker tools!"
    ],
    links: [
      { href: "vcos://kernel", text: "Read Kernel Specifications" },
      { href: "vcos://software", text: "Browse Software Center" },
      { href: "https://en.wikipedia.org/wiki/Operating_system", text: "Learn about Operating Systems on Wikipedia" }
    ],
    indexedAt: Date.now()
  },
  {
    url: "vcos://kernel",
    title: "VC.os Hybrid Kernel Specifications",
    snippet: "Technical details of the VC.os microkernel structure, boot sector, virtual filesystem, and interrupt descriptors.",
    content: "The VC.os hybrid kernel bridges assembly boot sectors with custom C++20 freestanding code. Key subsystems include: Interrupt Descriptor Table (IDT) running 32 core interrupts; the vcos_web_bridge.cpp browser handoff; dynamic paging and memory allocation using a 1MB bitmap manager; and a local Virtual File System (VFS) with native .tar.xz archive extraction capabilities.",
    paragraphs: [
      "The VC.os hybrid kernel bridges assembly boot sectors with custom C++20 freestanding code.",
      "Key subsystems include: Interrupt Descriptor Table (IDT) running 32 core interrupts; the vcos_web_bridge.cpp browser handoff; dynamic paging and memory allocation using a 1MB bitmap manager; and a local Virtual File System (VFS) with native .tar.xz archive extraction capabilities.",
      "Developer Notes: Boot instructions have been migrated to VMware Workstation Player raw-disk mounts to support true bare-metal virtualization."
    ],
    links: [
      { href: "vcos://welcome", text: "Return to Welcome Portal" },
      { href: "vcos://software", text: "VC.os Software Center" },
      { href: "https://reddit.com/r/osdev", text: "r/osdev Community" }
    ],
    indexedAt: Date.now()
  },
  {
    url: "vcos://software",
    title: "VC.os Software Center & Marketplace",
    snippet: "Discover and install applications, including Doom, Snake, Minesweeper, Game Maker, and system tools on VC.os.",
    content: "The Software Center provides native applications compiled for VC.os: 1) Doom Clone: Classic first-person shooter. 2) Game Maker: Build your own 2D games using native JavaScript canvas. 3) Alarm Clock and Timer. 4) Memory Bitmap Viewer: Visualizes RAM block occupancy in real time.",
    paragraphs: [
      "The Software Center provides native applications compiled for VC.os.",
      "Available Software:",
      "- Doom Clone: Classic 3D raycaster first-person shooter.",
      "- Game Maker: Build your own 2D games using native JavaScript canvas, save them to the disk, and share with multiplayer sync.",
      "- Alarm Clock and Timer: Keep track of time and trigger custom RTC alarm interruptions.",
      "- Memory Bitmap Viewer: Visualizes physical RAM block occupancy and page tables in real time."
    ],
    links: [
      { href: "vcos://welcome", text: "Return to Welcome Portal" },
      { href: "vcos://kernel", text: "Read Kernel Specifications" }
    ],
    indexedAt: Date.now()
  },
  {
    url: "https://en.wikipedia.org/wiki/Operating_system",
    title: "Operating System - Wikipedia",
    snippet: "An operating system (OS) is system software that manages computer hardware, software resources, and provides common services.",
    content: "An operating system (OS) is system software that manages computer hardware, software resources, and provides common services for computer programs. Time-sharing operating systems schedule tasks for efficient use of the system and may also include accounting software for cost allocation of processor time, mass storage, printing, and other resources. Modern operating systems are typically interactive and graphical, utilizing windows, icons, and menus to represent information.",
    paragraphs: [
      "An operating system (OS) is system software that manages computer hardware, software resources, and provides common services for computer programs.",
      "Time-sharing operating systems schedule tasks for efficient use of the system and may also include accounting software for cost allocation of processor time, mass storage, printing, and other resources.",
      "Modern operating systems are typically interactive and graphical, utilizing windows, icons, and menus to represent information."
    ],
    links: [
      { href: "https://news.ycombinator.com", text: "Hacker News Discussions" },
      { href: "https://reddit.com/r/osdev", text: "OSDev Reddit Sub" }
    ],
    indexedAt: Date.now()
  },
  {
    url: "https://news.ycombinator.com",
    title: "Hacker News",
    snippet: "A social news website focusing on computer science, entrepreneurship, and retro technology.",
    content: "Hacker News is a community-driven platform for technology enthusiasts. Popular topics include retro programming, compilers, kernel development, AI coding, web engineering, security vulnerabilities, and classic software architecture. Join discussions, share links, and vote on tech news!",
    paragraphs: [
      "Hacker News is a community-driven platform for technology enthusiasts.",
      "Popular topics include retro programming, compilers, kernel development, AI coding, web engineering, security vulnerabilities, and classic software architecture.",
      "Join discussions, share links, and vote on tech news! Be civil and read the guidelines."
    ],
    links: [
      { href: "https://en.wikipedia.org/wiki/Operating_system", text: "Wikipedia: Operating Systems" },
      { href: "https://github.com", text: "Explore GitHub Projects" }
    ],
    indexedAt: Date.now()
  }
];

export const SearchEngine: React.FC = () => {
  const { isWifiConnected } = useSettings();
  const [activeTab, setActiveTab] = useState<'explorer' | 'crawler'>('explorer');
  
  // Search & Navigation States
  const [queryInput, setQueryInput] = useState('');
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [instantAnswer, setInstantAnswer] = useState<DdgInstantAnswer | null>(null);
  const [readerPage, setReaderPage] = useState<IndexedPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // History stacks for navigation
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [forwardStack, setForwardStack] = useState<string[]>([]);

  // Autocomplete Suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Crawler and Index Database States
  const [dbPages, setDbPages] = useState<IndexedPage[]>([]);
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlLogs, setCrawlLogs] = useState<string[]>([]);
  const logTerminalEndRef = useRef<HTMLDivElement>(null);

  // Initialize and load databases
  useEffect(() => {
    const savedIndex = localStorage.getItem('vcos_search_index');
    if (savedIndex) {
      try {
        setDbPages(JSON.parse(savedIndex));
      } catch (e) {
        setDbPages(DEFAULT_PAGES);
      }
    } else {
      setDbPages(DEFAULT_PAGES);
      localStorage.setItem('vcos_search_index', JSON.stringify(DEFAULT_PAGES));
    }
  }, []);

  const saveIndexToStorage = (updated: IndexedPage[]) => {
    setDbPages(updated);
    localStorage.setItem('vcos_search_index', JSON.stringify(updated));
  };

  // Live Suggestion autocomplete handler
  useEffect(() => {
    if (!isWifiConnected) return;
    const term = queryInput.trim();
    if (term.length < 2 || term.startsWith('http') || term.startsWith('vcos://')) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`);
        if (response.ok) {
          const list = await response.json();
          setSuggestions(list.slice(0, 5));
        }
      } catch (e) {
        console.error("Autocomplete suggest fail", e);
      }
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [queryInput, isWifiConnected]);

  // Click outside listener for suggestions
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Primary search execution router
  const triggerSearch = async (e?: React.FormEvent, customTerm?: string) => {
    if (e) e.preventDefault();
    setShowSuggestions(false);

    const term = (customTerm !== undefined ? customTerm : queryInput).trim();
    if (!term) return;

    if (!isWifiConnected) {
      setError("No network interface connected. Check WiFi configuration.");
      return;
    }

    // Check if it's a direct URL address
    if (term.startsWith('http://') || term.startsWith('https://') || term.startsWith('vcos://')) {
      loadWebAddress(term);
      return;
    }

    setLoading(true);
    setError(null);
    setQueryInput(term);

    kernel.emitEvent('TASK', `VC_EXPLORER_SEARCH: "${term}"`);
    kernel.executeTask('BROWSER_REQ', 4);

    try {
      // 1. Match local index pages
      const searchTerms = term.toLowerCase().split(/[\s,.-]+/).filter(t => t.length > 1);
      const matchedLocal: SearchResult[] = [];

      if (searchTerms.length > 0) {
        dbPages.forEach(page => {
          let score = 0;
          const titleLower = page.title.toLowerCase();
          const urlLower = page.url.toLowerCase();
          const contentLower = page.content.toLowerCase();

          searchTerms.forEach(token => {
            const titleCount = (titleLower.match(new RegExp(`\\b${token}\\b`, 'g')) || []).length;
            const urlCount = (urlLower.match(new RegExp(token, 'g')) || []).length;
            const contentCount = (contentLower.match(new RegExp(token, 'g')) || []).length;
            const titleSub = titleCount === 0 && titleLower.includes(token) ? 1 : 0;
            score += (titleCount * 30) + (titleSub * 10) + (urlCount * 15) + (contentCount * 2);
          });

          if (score > 0) {
            matchedLocal.push({
              title: page.title,
              link: page.url,
              snippet: page.snippet || (page.content.slice(0, 140) + "..."),
              score: score + 100 // Boost local index matches
            });
          }
        });
      }

      matchedLocal.sort((a, b) => b.score - a.score);

      // 2. Query VC Search Backend (Proxied DuckDuckGo)
      let webResults: SearchResult[] = [];
      let instantAnswerObj: DdgInstantAnswer | null = null;

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        if (response.ok) {
          const data = await response.json();
          if (data) {
            if (data.abstractText) {
              instantAnswerObj = {
                heading: data.heading || term,
                abstractText: data.abstractText,
                abstractSource: data.abstractSource || "VC System Index",
                abstractURL: data.abstractURL || "",
                image: data.image || ""
              };
            }
            if (data.items) {
              webResults = data.items.map((item: any, index: number) => ({
                title: item.title,
                link: item.link,
                snippet: item.snippet,
                score: Math.max(10, 90 - index * 5)
              }));
            }
          }
        }
      } catch (err) {
        console.error("Internal index search fail:", err);
      }

      // 3. Deduplicate and merge results
      const mergedResults: SearchResult[] = [...matchedLocal];
      const seenUrls = new Set<string>(matchedLocal.map(r => r.link.toLowerCase()));

      webResults.forEach(r => {
        const urlKey = r.link.toLowerCase();
        if (!seenUrls.has(urlKey)) {
          seenUrls.add(urlKey);
          mergedResults.push(r);
        }
      });

      mergedResults.sort((a, b) => b.score - a.score);

      // Save States
      setResults(mergedResults);
      setInstantAnswer(instantAnswerObj);
      setReaderPage(null);
      setActiveUrl(null);
      setLoading(false);

    } catch (err: any) {
      setError(err.message || "Failed to retrieve index nodes.");
      setLoading(false);
    }
  };

  // Direct Address Loader
  const loadWebAddress = async (targetUrl: string) => {
    let formatted = targetUrl.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://') && !formatted.startsWith('vcos://')) {
      formatted = 'https://' + formatted;
    }

    if (!isWifiConnected) {
      setError("WiFi Network disconnected. Handshake terminated.");
      return;
    }

    setLoading(true);
    setError(null);
    setQueryInput(formatted);

    kernel.emitEvent('TASK', `VC_EXPLORER_GET_PAGE: ${formatted}`);

    try {
      // Check local cache
      const localMatch = dbPages.find(p => p.url.toLowerCase() === formatted.toLowerCase());
      if (localMatch) {
        const nextStack = activeUrl ? [...historyStack, activeUrl] : historyStack;
        setHistoryStack(nextStack);
        setForwardStack([]);
        setActiveUrl(formatted);
        setReaderPage(localMatch);
        setLoading(false);
        return;
      }

      // Fetch dynamic crawler proxies
      const pageResult = await crawlSinglePage(formatted, false);

      const nextStack = activeUrl ? [...historyStack, activeUrl] : historyStack;
      setHistoryStack(nextStack);
      setForwardStack([]);
      setActiveUrl(formatted);
      setReaderPage(pageResult);
      setLoading(false);

      // Auto save newly crawled page to system database
      const exists = dbPages.some(p => p.url.toLowerCase() === pageResult.url.toLowerCase());
      if (!exists) {
        const updated = [pageResult, ...dbPages];
        saveIndexToStorage(updated);
      }

    } catch (err: any) {
      setError(`Handshake timed out or rejected: ${err.message || 'Host offline'}`);
      setLoading(false);
    }
  };

  // Internal Crawler Core scraper logic
  const crawlSinglePage = async (url: string, verboseLogging: boolean): Promise<IndexedPage> => {
    const log = (msg: string) => {
      if (verboseLogging) {
        setCrawlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
      }
    };

    let target = url.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('vcos://')) {
      target = 'https://' + target;
    }

    // Resolving system protocol pages
    if (target.startsWith('vcos://')) {
      log(`Resolving local VC.os system reference...`);
      const systemMatch = DEFAULT_PAGES.find(p => p.url === target);
      if (systemMatch) {
        log(`Mapping found for: ${systemMatch.title}`);
        return { ...systemMatch };
      }
      return {
        url: target,
        title: `VC.os System Node: ${target.replace('vcos://', '')}`,
        snippet: `Custom offline system interface compiled inside memory tables.`,
        content: `System path loaded securely. Diagnostic parameters report operational.`,
        paragraphs: [`System path loaded securely. Diagnostic parameters report operational.`],
        links: [{ href: 'vcos://welcome', text: 'Return to welcome page' }],
        indexedAt: Date.now()
      };
    }

    log(`Initializing secure TLS socket tunnel...`);
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(target)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Remote node rejected connection. Status Code: ${response.status}`);
    }

    log(`Connected. Scraped payload acquired.`);
    const html = await response.text();
    log(`Document size: ${Math.ceil(html.length / 1024)} KB. Filtering nodes...`);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let title = doc.title || target;
    title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    log(`Resolved document title: "${title}"`);

    doc.querySelectorAll('script, style, iframe, svg, header, footer, nav, noscript').forEach(el => el.remove());

    const paragraphs: string[] = [];
    doc.querySelectorAll('p, li, h1, h2, h3').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 30 && paragraphs.length < 15) {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length === 0) {
      const text = doc.body?.textContent || "";
      const split = text.split('\n').map(l => l.trim()).filter(l => l.length > 50);
      paragraphs.push(...split.slice(0, 10));
    }

    log(`Registered text content blocks: ${paragraphs.length} strings extracted.`);

    const links: { href: string; text: string }[] = [];
    doc.querySelectorAll('a').forEach(anchor => {
      const href = anchor.getAttribute('href');
      const text = anchor.textContent?.trim();
      if (href && text && text.length > 2 && links.length < 15) {
        let resolved = href;
        if (href.startsWith('/')) {
          try {
            const u = new URL(target);
            resolved = `${u.protocol}//${u.host}${href}`;
          } catch (e) {}
        }
        if (resolved.startsWith('http') || resolved.startsWith('vcos://')) {
          links.push({ href: resolved, text: text.slice(0, 50) });
        }
      }
    });

    log(`Discovered reference outbound links: ${links.length} URLs.`);

    return {
      url: target,
      title,
      snippet: paragraphs[0]?.slice(0, 150) + "..." || "Parsed text database block.",
      content: paragraphs.join(' '),
      paragraphs,
      links,
      indexedAt: Date.now()
    };
  };

  // Manual trigger from Crawler tab
  const handleManualCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crawlUrl.trim() || isCrawling) return;

    if (!isWifiConnected) {
      setCrawlLogs(prev => [...prev, `[ERROR] Scraper aborted: Network interface is DOWN.`]);
      return;
    }

    setIsCrawling(true);
    setCrawlLogs([]);

    try {
      const result = await crawlSinglePage(crawlUrl, true);
      const filtered = dbPages.filter(p => p.url.toLowerCase() !== result.url.toLowerCase());
      const updated = [result, ...filtered];
      saveIndexToStorage(updated);

      setCrawlLogs(prev => [
        ...prev,
        `\n[SUCCESS] Document parsed and saved to local search index table!`,
        `[METRICS] Page Title: ${result.title}`,
        `[METRICS] Local database contains ${updated.length} indexed records.`
      ]);
      setCrawlUrl('');
    } catch (err: any) {
      setCrawlLogs(prev => [...prev, `\n[CRAWL FAULT] ${err.message || 'Scraper encountered a firewall or timeout.'}`]);
    } finally {
      setIsCrawling(false);
    }
  };

  // Classic navigation controls
  const handleBack = () => {
    if (historyStack.length > 0) {
      const previous = historyStack[historyStack.length - 1];
      const nextForward = activeUrl || queryInput;
      
      const localMatch = dbPages.find(p => p.url.toLowerCase() === previous.toLowerCase());

      setForwardStack(prev => [...prev, nextForward]);
      setHistoryStack(prev => prev.slice(0, -1));
      setActiveUrl(previous);
      setQueryInput(previous);
      setReaderPage(localMatch || null);

      if (!localMatch && previous.startsWith('http')) {
        loadWebAddress(previous);
      }
    } else {
      // Clear all reader state and go back to results
      setActiveUrl(null);
      setReaderPage(null);
    }
  };

  const handleForward = () => {
    if (forwardStack.length > 0) {
      const next = forwardStack[forwardStack.length - 1];
      const nextStack = activeUrl ? [...historyStack, activeUrl] : historyStack;

      const localMatch = dbPages.find(p => p.url.toLowerCase() === next.toLowerCase());

      setHistoryStack(nextStack);
      setForwardStack(prev => prev.slice(0, -1));
      setActiveUrl(next);
      setQueryInput(next);
      setReaderPage(localMatch || null);

      if (!localMatch && next.startsWith('http')) {
        loadWebAddress(next);
      }
    }
  };

  const handleHome = () => {
    setActiveUrl(null);
    setReaderPage(null);
    setResults([]);
    setInstantAnswer(null);
    setQueryInput('');
  };

  const handleDeleteIndex = (url: string) => {
    const updated = dbPages.filter(p => p.url !== url);
    saveIndexToStorage(updated);
  };

  // Scroll crawler logs
  useEffect(() => {
    if (logTerminalEndRef.current) {
      logTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [crawlLogs]);

  return (
    <div className="h-full flex flex-col font-mono text-[12px] bg-win95-gray text-black select-none">
      
      {/* 1. Classic Inset Navigation Header */}
      <div className="p-1 border-b-2 border-white bg-win95-gray flex items-center justify-between shrink-0 select-none shadow-sm">
        {/* Navigation Action Buttons (Win95 styling with gray colors) */}
        <div className="flex items-center gap-1">
          <button 
            onClick={handleBack}
            disabled={!activeUrl && historyStack.length === 0}
            className="px-2 py-1 bg-win95-gray border-outset hover:bg-zinc-100 active:border-inset disabled:opacity-30 disabled:pointer-events-none rounded font-bold flex items-center gap-1 text-[11px]"
            title="Go Back"
          >
            <ArrowLeft size={11} /> Back
          </button>
          <button 
            onClick={handleForward}
            disabled={forwardStack.length === 0}
            className="px-2 py-1 bg-win95-gray border-outset hover:bg-zinc-100 active:border-inset disabled:opacity-30 disabled:pointer-events-none rounded font-bold flex items-center gap-1 text-[11px]"
            title="Go Forward"
          >
            Forward <ArrowRight size={11} />
          </button>
          <button 
            onClick={() => {
              if (activeUrl) loadWebAddress(activeUrl);
              else if (queryInput) triggerSearch();
            }}
            className="px-2 py-1 bg-win95-gray border-outset hover:bg-zinc-100 active:border-inset rounded font-bold flex items-center gap-1 text-[11px]"
            title="Refresh"
          >
            <RefreshCw size={11} /> Refresh
          </button>
          <button 
            onClick={handleHome}
            className="px-2 py-1 bg-win95-gray border-outset hover:bg-zinc-100 active:border-inset rounded font-bold flex items-center gap-1 text-[11px]"
            title="Home"
          >
            <Home size={11} /> Home
          </button>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="flex border border-zinc-400 rounded overflow-hidden shadow-sm">
          <button 
            onClick={() => setActiveTab('explorer')}
            className={`px-3 py-1 text-[10px] font-bold uppercase flex items-center gap-1.5 ${activeTab === 'explorer' ? 'bg-win95-blue text-white' : 'bg-zinc-300 text-black hover:bg-zinc-200'}`}
          >
            <Globe size={11} /> Explorer
          </button>
          <button 
            onClick={() => setActiveTab('crawler')}
            className={`px-3 py-1 text-[10px] font-bold uppercase flex items-center gap-1.5 ${activeTab === 'crawler' ? 'bg-win95-blue text-white' : 'bg-zinc-300 text-black hover:bg-zinc-200'}`}
          >
            <Database size={11} /> Crawler Core ({dbPages.length})
          </button>
        </div>
      </div>

      {/* 2. Main Address Bar Row */}
      {activeTab === 'explorer' && (
        <div className="p-1.5 bg-win95-gray border-b border-white flex items-center gap-1.5 shrink-0 shadow-xs">
          <div className="flex items-center gap-1 text-green-700 font-bold text-[9px] bg-green-50 px-1.5 py-0.5 border border-green-200 rounded-sm select-none">
            <Lock size={9} />
            <span>SECURE</span>
          </div>

          {/* Core URL input with live suggest dropdown */}
          <div className="flex-1 relative flex items-center bg-white border-inset px-2 py-1 min-h-[26px]">
            <input 
              type="text" 
              className="w-full bg-transparent text-black outline-none font-mono text-[11px]"
              value={queryInput}
              onFocus={() => {
                if (queryInput.trim().length >= 2) setShowSuggestions(true);
              }}
              onChange={(e) => {
                setQueryInput(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  triggerSearch();
                }
              }}
              placeholder="Enter search phrase or full URL..."
            />

            {/* Absolute Suggest Overlay */}
            {showSuggestions && suggestions.length > 0 && (
              <div 
                ref={suggestionRef}
                className="absolute left-0 right-0 top-[26px] bg-white border border-zinc-400 shadow-md z-50 rounded-b-sm select-none text-[11px]"
              >
                {suggestions.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setQueryInput(item);
                      setShowSuggestions(false);
                      triggerSearch(undefined, item);
                    }}
                    className="px-3 py-1.5 hover:bg-win95-blue hover:text-white cursor-pointer flex items-center gap-2 border-b border-zinc-100 last:border-b-0"
                  >
                    <Search size={10} className="text-zinc-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={() => triggerSearch()}
            className="px-4 py-1 bg-win95-gray border-outset hover:bg-zinc-100 active:border-inset font-bold uppercase text-[10px]"
          >
            GO
          </button>
        </div>
      )}

      {/* 3. Screen Viewports */}
      <div className="flex-1 overflow-hidden relative bg-black flex flex-col">
        {!isWifiConnected ? (
          
          /* Wifi block display */
          <div className="flex-1 bg-zinc-900 flex flex-col items-center justify-center gap-3 text-red-500 p-6">
            <WifiOff size={40} className="opacity-50 animate-pulse text-red-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">Wifi Link Closed</h2>
            <p className="text-center text-[11px] text-zinc-400 max-w-xs">
              Explorer cannot query online proxies while the WiFi interface is disconnected.
            </p>
          </div>

        ) : activeTab === 'explorer' ? (
          
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {loading ? (
              
              /* Standard loading display */
              <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-[#fafafa]">
                <div className="w-6 h-6 border-2 border-win95-blue border-t-transparent rounded-full animate-spin" />
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Querying Virtual Index Nodes...</p>
              </div>

            ) : error ? (
              
              /* Simple error card */
              <div className="flex-1 flex items-center justify-center p-6 bg-[#fafafa]">
                <div className="border-2 border-red-500 bg-red-50 p-4 max-w-sm text-center shadow-sm">
                  <AlertCircle size={24} className="text-red-500 mx-auto mb-1" />
                  <p className="font-bold text-red-600 text-[11px] uppercase">Connection Failed</p>
                  <p className="text-zinc-600 text-[11px] mt-1.5 leading-relaxed">{error}</p>
                  <button 
                    onClick={() => setError(null)} 
                    className="mt-3 px-3 py-1 bg-white border border-red-300 text-red-600 text-[10px] font-bold rounded hover:bg-red-100"
                  >
                    DISMISS
                  </button>
                </div>
              </div>

            ) : readerPage && activeUrl ? (
              
              /* READER VIEW (Website display) */
              <div className="flex-1 flex flex-col overflow-hidden bg-white select-text">
                <div className="bg-zinc-100 border-b border-zinc-200 px-3 py-1 flex items-center justify-between text-[10px] text-zinc-500 shrink-0">
                  <span className="font-bold text-zinc-700">VC_READER LAYER (PROXIED)</span>
                  <button 
                    onClick={() => window.open(activeUrl, '_blank')}
                    className="text-blue-600 hover:underline flex items-center gap-1 font-bold text-[9px]"
                  >
                    Open original <ExternalLink size={9} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 select-text selection:bg-blue-200">
                  <div className="max-w-xl mx-auto space-y-4">
                    <div className="border-b border-zinc-200 pb-2">
                      <h1 className="text-xl font-bold text-zinc-900 leading-tight">{readerPage.title}</h1>
                      <p className="text-green-700 text-[10px] truncate break-all font-mono select-all">{readerPage.url}</p>
                    </div>

                    <div className="space-y-3.5 text-zinc-800 leading-relaxed text-[12px] font-sans">
                      {readerPage.paragraphs.map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))}
                    </div>

                    {readerPage.links && readerPage.links.length > 0 && (
                      <div className="mt-8 border-t border-zinc-200 pt-4">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Registered Hypertexts:</p>
                        <div className="grid grid-cols-1 gap-2">
                          {readerPage.links.map((link, idx) => (
                            <button
                              key={idx}
                              onClick={() => loadWebAddress(link.href)}
                              className="text-left p-2 border border-zinc-100 hover:border-blue-200 rounded hover:bg-blue-50/40 text-[11px] flex flex-col"
                            >
                              <span className="text-blue-600 font-bold hover:underline truncate">{link.text}</span>
                              <span className="text-[9px] text-zinc-400 truncate font-mono">{link.href}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            ) : results.length > 0 ? (
              
              /* SEARCH RESULTS PANEL */
              <div className="flex-1 overflow-y-auto p-4 select-text bg-zinc-50">
                <div className="max-w-2xl mx-auto space-y-4">
                  
                  {/* Instant Fact / Summary Card */}
                  {instantAnswer && (
                    <div className="bg-white border-l-4 border-win95-blue p-4 shadow-xs border border-zinc-200 rounded flex gap-4 items-start">
                      {instantAnswer.image && (
                        <img 
                          src={instantAnswer.image} 
                          alt="preview" 
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded object-cover border border-zinc-200 shrink-0 bg-zinc-50" 
                        />
                      )}
                      <div className="flex-1 space-y-1">
                        <span className="bg-win95-blue text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider">Fast Facts</span>
                        <h2 className="text-base font-bold text-zinc-950 leading-tight">{instantAnswer.heading}</h2>
                        <p className="text-zinc-600 text-[12px] leading-relaxed">{instantAnswer.abstractText}</p>
                        {instantAnswer.abstractURL && (
                          <button 
                            onClick={() => loadWebAddress(instantAnswer.abstractURL)}
                            className="mt-1 text-[11px] text-blue-600 hover:underline font-bold flex items-center gap-1"
                          >
                            Read Reference Citation <ExternalLink size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Organic Results List */}
                  <div className="space-y-3">
                    {results.map((res, index) => (
                      <div key={index} className="bg-white border border-zinc-200 p-3.5 shadow-xs hover:border-zinc-300 rounded transition-all">
                        <button 
                          onClick={() => loadWebAddress(res.link)}
                          className="text-left text-blue-700 hover:underline font-bold text-[13px] block truncate w-full"
                        >
                          {res.title}
                        </button>
                        <span className="text-green-700 text-[10px] block font-mono truncate mb-1 select-all">{res.link}</span>
                        <p className="text-zinc-600 text-[11.5px] leading-relaxed">{res.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            ) : (
              
              /* EXPANSION PORTAL HOMEPAGE (Search Landing Page) */
              <div className="flex-1 flex flex-col justify-between p-6 bg-zinc-100 select-none overflow-y-auto">
                <div className="max-w-md mx-auto w-full my-auto space-y-6 text-center">
                  
                  {/* Styled Logo Title using tracked uppercase Display Font */}
                  <div className="space-y-1">
                    <h1 className="text-3xl font-black uppercase tracking-widest text-zinc-950 flex items-center justify-center gap-2">
                      <Globe size={28} className="text-win95-blue" />
                      VC.explorer
                    </h1>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Virtual Index Node Search Utility</p>
                  </div>

                  {/* Centered Search box */}
                  <div className="relative">
                    <div className="flex items-center bg-white border-inset p-1 shadow-sm rounded-sm">
                      <input 
                        type="text" 
                        className="w-full bg-transparent text-black outline-none font-mono text-[12px] px-2"
                        placeholder="Search system nodes, definition tables or URLs..."
                        value={queryInput}
                        onFocus={() => {
                          if (queryInput.trim().length >= 2) setShowSuggestions(true);
                        }}
                        onChange={(e) => {
                          setQueryInput(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            triggerSearch();
                          }
                        }}
                      />
                      <button 
                        onClick={() => triggerSearch()}
                        className="px-4 py-1.5 bg-win95-gray border-outset hover:bg-zinc-100 active:border-inset font-bold uppercase text-[10.5px]"
                      >
                        SEARCH
                      </button>
                    </div>

                    {/* Suggestions list dropdown overlay */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div 
                        ref={suggestionRef}
                        className="absolute left-0 right-0 top-[38px] bg-white border border-zinc-400 shadow-md z-50 text-left rounded-b-sm select-none text-[11px]"
                      >
                        {suggestions.map((phrase, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setQueryInput(phrase);
                              setShowSuggestions(false);
                              triggerSearch(undefined, phrase);
                            }}
                            className="px-3 py-1.5 hover:bg-win95-blue hover:text-white cursor-pointer flex items-center gap-2 border-b border-zinc-100 last:border-b-0"
                          >
                            <Search size={10} className="text-zinc-400 shrink-0" />
                            <span>{phrase}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">
                    Private virtual proxies active — No tracking logs retained
                  </p>

                  {/* Pre-seeded system bookmark blocks (Speed dial) */}
                  <div className="pt-2">
                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">System Bookmark Indexes</p>
                    <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                      <button 
                        onClick={() => loadWebAddress('vcos://welcome')}
                        className="p-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-left rounded shadow-2xs flex items-center gap-2"
                      >
                        <Layers size={14} className="text-win95-blue" />
                        <div className="truncate">
                          <div className="font-bold text-[10px] text-zinc-800">Welcome Portal</div>
                          <div className="text-[8px] text-zinc-400 font-mono truncate">vcos://welcome</div>
                        </div>
                      </button>
                      <button 
                        onClick={() => loadWebAddress('vcos://kernel')}
                        className="p-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-left rounded shadow-2xs flex items-center gap-2"
                      >
                        <Shield size={14} className="text-green-600" />
                        <div className="truncate">
                          <div className="font-bold text-[10px] text-zinc-800">Kernel Spec</div>
                          <div className="text-[8px] text-zinc-400 font-mono truncate">vcos://kernel</div>
                        </div>
                      </button>
                      <button 
                        onClick={() => loadWebAddress('https://en.wikipedia.org/wiki/Operating_system')}
                        className="p-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-left rounded shadow-2xs flex items-center gap-2"
                      >
                        <Globe size={14} className="text-blue-500" />
                        <div className="truncate">
                          <div className="font-bold text-[10px] text-zinc-800">Wikipedia</div>
                          <div className="text-[8px] text-zinc-400 font-mono truncate">wikipedia.org</div>
                        </div>
                      </button>
                      <button 
                        onClick={() => loadWebAddress('https://news.ycombinator.com')}
                        className="p-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-left rounded shadow-2xs flex items-center gap-2"
                      >
                        <ExternalLink size={14} className="text-orange-500" />
                        <div className="truncate">
                          <div className="font-bold text-[10px] text-zinc-800">Hacker News</div>
                          <div className="text-[8px] text-zinc-400 font-mono truncate">ycombinator.com</div>
                        </div>
                      </button>
                    </div>
                  </div>

                </div>

                {/* Footer status blocks */}
                <div className="border-t border-zinc-200 pt-3 flex items-center justify-between text-[9.5px] text-zinc-400 uppercase font-bold select-none">
                  <span>Network: Handshake Connected</span>
                  <span>Port: 3000 (HTTP Tunneling)</span>
                  <span>Zone: Secure_Sandbox</span>
                </div>
              </div>

            )}
          </div>

        ) : (
          
          /* CRAWLER TAB (Terminal interface to scrape indexing parameters) */
          <div className="flex-1 flex flex-col overflow-hidden bg-zinc-900 select-text">
            {/* Scraper panel header */}
            <div className="p-3 bg-zinc-800 border-b border-zinc-700 flex flex-col md:flex-row gap-3 items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-green-500" />
                <span className="font-bold text-white text-[11px] uppercase tracking-wide">Manual Scraping Tunnel Console</span>
              </div>
              <form onSubmit={handleManualCrawl} className="flex gap-2 w-full md:w-auto">
                <input 
                  type="text" 
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  placeholder="https://example.com" 
                  className="bg-black border border-zinc-600 text-green-400 text-[11px] px-2 py-1 outline-none font-mono flex-1 md:w-64 rounded-sm"
                  disabled={isCrawling}
                />
                <button 
                  type="submit"
                  disabled={isCrawling || !crawlUrl.trim()}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold px-3 py-1 text-[10px] uppercase rounded-sm disabled:opacity-40"
                >
                  {isCrawling ? 'SCALING...' : 'INDEX'}
                </button>
              </form>
            </div>

            {/* Main crawl interface splitting indexing list and terminal logs */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Terminal Logs view */}
              <div className="flex-1 bg-black p-4 font-mono text-[11px] text-green-400 overflow-y-auto border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col">
                <p className="text-zinc-500 select-none">// VC_EXPLORER CRAWLER PROTOCOL v1.0.0</p>
                <p className="text-zinc-500 select-none">// Ready to intercept network handshakes...</p>
                
                <div className="flex-1 space-y-1 mt-2">
                  {crawlLogs.map((log, i) => (
                    <div key={i} className="whitespace-pre-wrap">{log}</div>
                  ))}
                  <div ref={logTerminalEndRef} />
                </div>
              </div>

              {/* Indexed database view */}
              <div className="w-full md:w-72 bg-zinc-950 p-3 overflow-y-auto text-zinc-300 select-none flex flex-col">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2 shrink-0">Registered Search Indices ({dbPages.length})</span>
                <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
                  {dbPages.map((page, i) => (
                    <div key={i} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-sm flex items-start gap-2 justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-white truncate">{page.title}</div>
                        <div className="text-[9px] text-zinc-500 font-mono truncate">{page.url}</div>
                      </div>
                      <button 
                        onClick={() => handleDeleteIndex(page.url)}
                        className="text-red-500 hover:text-red-400 p-1 hover:bg-zinc-800 rounded shrink-0"
                        title="Delete record"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        )}
      </div>
    </div>
  );
};
