import React, { useState, useRef, useEffect } from 'react';
import { Search, Globe, ArrowLeft, ArrowRight, RotateCw, ExternalLink, Shield, WifiOff, Database, Terminal, Plus, Trash2, History, BookOpen, AlertCircle, Check, FileText } from 'lucide-react';
import { kernel } from '../services/kernel';
import { useSettings } from '../hooks/useSettings';

interface IndexedPage {
  url: string;
  title: string;
  snippet: string;
  content: string; // full body text for matching
  paragraphs: string[]; // structured text lines
  links: { href: string; text: string }[]; // extracted outlinks
  indexedAt: number;
}

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  score: number;
}

// Default high-quality seeded pages for the bare-metal engine
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
  },
  {
    url: "https://github.com",
    title: "GitHub: Let's build from here",
    snippet: "The world's leading AI-powered developer platform where millions of developers build, run, and secure code.",
    content: "GitHub is where developers store their source code, collaborate on open-source software, manage software releases, and use automated build pipelines (GitHub Actions). It supports git-based version control for millions of active repositories including OS kernels, frontend frameworks, and retro compilers.",
    paragraphs: [
      "GitHub is where developers store their source code, collaborate on open-source software, manage software releases, and use automated build pipelines (GitHub Actions).",
      "It supports git-based version control for millions of active repositories including OS kernels, frontend frameworks, and retro compilers."
    ],
    links: [
      { href: "https://news.ycombinator.com", text: "Hacker News Discussions" }
    ],
    indexedAt: Date.now()
  },
  {
    url: "https://reddit.com/r/osdev",
    title: "Operating System Development on Reddit",
    snippet: "The main subreddit for OS development. Share your hobby operating systems, ask questions about bootloaders, paging, and kernel structures.",
    content: "Welcome to r/osdev! A place for developers of custom operating systems. Learn about writing boot sectors in assembly, setting up paging in protected mode, building FAT12/FAT32 filesystems, implementing task switching, and debugging kernels using QEMU, VMware, or Bochs.",
    paragraphs: [
      "Welcome to r/osdev! A place for developers of custom operating systems.",
      "Learn about writing boot sectors in assembly, setting up paging in protected mode, building FAT12/FAT32 filesystems, implementing task switching, and debugging kernels using QEMU, VMware, or Bochs."
    ],
    links: [
      { href: "vcos://kernel", text: "VC.os Hybrid Kernel Specifications" },
      { href: "https://en.wikipedia.org/wiki/Operating_system", text: "Wikipedia: Operating System" }
    ],
    indexedAt: Date.now()
  }
];

export const SearchEngine: React.FC = () => {
  const { isWifiConnected } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  
  // Navigation stack for back operations in our custom Reader mode
  const [navStack, setNavStack] = useState<string[]>([]);
  const [navForwardStack, setNavForwardStack] = useState<string[]>([]);
  
  // Built-in Reader page content state
  const [readerPage, setReaderPage] = useState<IndexedPage | null>(null);

  // Bare-metal crawler/indexing states
  const [dbPages, setDbPages] = useState<IndexedPage[]>([]);
  const [currentTab, setCurrentTab] = useState<'search' | 'crawler'>('search');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlLogs, setCrawlLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const logTerminalEndRef = useRef<HTMLDivElement>(null);

  // Initialize from LocalStorage or seed defaults
  useEffect(() => {
    const saved = localStorage.getItem('vcos_search_index');
    if (saved) {
      try {
        setDbPages(JSON.parse(saved));
      } catch (e) {
        setDbPages(DEFAULT_PAGES);
      }
    } else {
      setDbPages(DEFAULT_PAGES);
      localStorage.setItem('vcos_search_index', JSON.stringify(DEFAULT_PAGES));
    }
  }, []);

  // Auto scroll logs
  useEffect(() => {
    if (logTerminalEndRef.current) {
      logTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [crawlLogs]);

  const saveIndexToStorage = (updated: IndexedPage[]) => {
    setDbPages(updated);
    localStorage.setItem('vcos_search_index', JSON.stringify(updated));
  };

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const activeQuery = (customQuery !== undefined ? customQuery : query).trim();
    if (!activeQuery) return;

    if (!isWifiConnected) {
      setError("No connection to the Internet. Please check your Wifi Manager.");
      return;
    }

    setError(null);
    setLoading(true);
    setReaderPage(null);
    setActiveUrl(null);

    // Direct URL entry or vcos custom link check
    if (activeQuery.startsWith('http://') || activeQuery.startsWith('https://') || activeQuery.startsWith('vcos://')) {
      openUrlInReader(activeQuery);
      return;
    }

    kernel.emitEvent('TASK', `BARE_METAL_SEARCH: "${activeQuery}"`);
    kernel.executeTask('BROWSER_REQ', 4);

    try {
      const searchTerms = activeQuery.toLowerCase().split(/[\s,.-]+/).filter(t => t.length > 1);
      const scoredLocal: SearchResult[] = [];

      if (searchTerms.length > 0) {
        dbPages.forEach(page => {
          let score = 0;
          const titleLower = page.title.toLowerCase();
          const urlLower = page.url.toLowerCase();
          const contentLower = page.content.toLowerCase();

          searchTerms.forEach(term => {
            const titleCount = (titleLower.match(new RegExp(`\\b${term}\\b`, 'g')) || []).length;
            const urlCount = (urlLower.match(new RegExp(term, 'g')) || []).length;
            const contentCount = (contentLower.match(new RegExp(term, 'g')) || []).length;
            const titleSubMatch = titleCount === 0 && titleLower.includes(term) ? 1 : 0;
            score += (titleCount * 25) + (titleSubMatch * 10) + (urlCount * 15) + (contentCount * 1);
          });

          if (score > 0) {
            scoredLocal.push({
              title: page.title,
              link: page.url,
              snippet: page.snippet || (page.content.slice(0, 150) + "..."),
              score
            });
          }
        });
      }

      scoredLocal.sort((a, b) => b.score - a.score);

      // Perform Real Web Search from server API
      let webResults: SearchResult[] = [];
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(activeQuery)}`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.items) {
            webResults = data.items.map((item: any, idx: number) => ({
              title: item.title,
              link: item.link,
              snippet: item.snippet,
              score: Math.max(10, 80 - idx * 5)
            }));
          }
        }
      } catch (err) {
        console.error("Web search API fetch failed:", err);
      }

      // Merge and remove duplicates by URL
      const mergedResults: SearchResult[] = [...scoredLocal];
      const seenUrls = new Set<string>(scoredLocal.map(r => r.link.toLowerCase()));

      webResults.forEach(r => {
        const urlKey = r.link.toLowerCase();
        if (!seenUrls.has(urlKey)) {
          seenUrls.add(urlKey);
          mergedResults.push(r);
        }
      });

      mergedResults.sort((a, b) => b.score - a.score);

      setResults(mergedResults);
      setHistory(prev => {
        const next = [activeQuery, ...prev.filter(q => q !== activeQuery)];
        return next.slice(0, 10);
      });
    } catch (err: any) {
      setError(err.message || "Failed to search index registry.");
    } finally {
      setLoading(false);
    }
  };

  const openUrlInReader = async (url: string) => {
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://') && !formattedUrl.startsWith('vcos://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    if (!isWifiConnected) {
      setError("No connection to the Internet. Please check your Wifi Manager.");
      return;
    }

    setError(null);
    setLoading(true);
    kernel.emitEvent('TASK', `CRAWLER_GET_READER: ${formattedUrl}`);

    try {
      // Check if page is already in our local index DB
      const existingPage = dbPages.find(p => p.url.toLowerCase() === formattedUrl.toLowerCase());
      if (existingPage) {
        if (activeUrl) {
          setNavStack(prev => [...prev, activeUrl]);
        }
        setNavForwardStack([]);
        setActiveUrl(formattedUrl);
        setQuery(formattedUrl);
        setReaderPage(existingPage);
        setLoading(false);
        return;
      }

      // If page is not indexed yet, we crawl it dynamically on-the-fly!
      const crawled = await runLiveCrawl(formattedUrl, false);
      if (activeUrl) {
        setNavStack(prev => [...prev, activeUrl]);
      }
      setNavForwardStack([]);
      setActiveUrl(formattedUrl);
      setQuery(formattedUrl);
      setReaderPage(crawled);

      // Automatically add this to our bare-metal index so it becomes searchable!
      const exists = dbPages.some(p => p.url.toLowerCase() === crawled.url.toLowerCase());
      if (!exists) {
        const updated = [crawled, ...dbPages];
        saveIndexToStorage(updated);
      }
    } catch (err: any) {
      setError(`Unable to parse webpage structure. Please verify the URL or try another domain. Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // The bare-metal webpage crawler engine (fetches HTML, strips scripts/tags, extracts text & titles)
  const runLiveCrawl = async (urlToCrawl: string, verboseLogging: boolean = false): Promise<IndexedPage> => {
    const log = (msg: string) => {
      if (verboseLogging) {
        setCrawlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
      }
    };

    let targetUrl = urlToCrawl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && !targetUrl.startsWith('vcos://')) {
      targetUrl = 'https://' + targetUrl;
    }

    // Handlers for simulated vcos system resources
    if (targetUrl.startsWith('vcos://')) {
      log(`Resolving local VC.os Virtual File Address...`);
      const defaultMatch = DEFAULT_PAGES.find(p => p.url === targetUrl);
      if (defaultMatch) {
        log(`System mapping discovered: "${defaultMatch.title}"`);
        log(`Page indexing finished successfully.`);
        return { ...defaultMatch };
      }
      return {
        url: targetUrl,
        title: `VC.os System Link: ${targetUrl.replace('vcos://', '')}`,
        snippet: `A custom system page on the VC.os Virtual Network.`,
        content: `Mapped system path resolved. Welcome to ${targetUrl}. Operational indices report healthy network operations.`,
        paragraphs: [
          `Mapped system path resolved. Welcome to ${targetUrl}.`,
          `Operational indices report healthy network operations. No threats detected.`
        ],
        links: [{ href: 'vcos://welcome', text: 'Return to Welcome Portal' }],
        indexedAt: Date.now()
      };
    }

    log(`Initiating HTTP handshake over VC_PROXY tunnel...`);
    log(`Connecting to remote host: ${new URL(targetUrl).hostname}`);
    
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Connection timed out or host rejected. Status: ${response.status}`);
    }

    log(`Handshake accepted. Downloading HTML document byte blocks...`);
    const html = await response.text();
    log(`Download complete. Loaded ${Math.ceil(html.length / 1024)} KB payload.`);
    log(`Parsing HTML Document Object Model...`);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Title Extraction
    let title = doc.title || targetUrl;
    title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    log(`Parsed document title: "${title}"`);

    // Clean scripts, styles, layouts
    log(`Executing bare-metal script sanitization and layout stripping...`);
    doc.querySelectorAll('script, style, iframe, noscript, svg, header, footer, nav, link, meta, form, button').forEach(el => el.remove());

    // Extract text blocks
    const paragraphs: string[] = [];
    doc.querySelectorAll('p, h1, h2, h3, h4, h5, li').forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 25 && paragraphs.length < 15) {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length === 0) {
      const textContent = doc.body?.textContent || "";
      const splitLines = textContent.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 40);
      paragraphs.push(...splitLines.slice(0, 10));
    }

    const fullContent = paragraphs.join(' ');
    log(`Scraped ${paragraphs.length} paragraphs. Compiling token index...`);

    // Extract Outlinks
    log(`Mapping hypertext outgoing anchor references...`);
    const links: { href: string; text: string }[] = [];
    doc.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href');
      const text = a.textContent?.trim();
      if (href && text && text.length > 2 && links.length < 25) {
        let resolved = href;
        if (href.startsWith('/')) {
          try {
            const u = new URL(targetUrl);
            resolved = `${u.protocol}//${u.host}${href}`;
          } catch (e) {}
        } else if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('vcos://') && !href.startsWith('javascript:')) {
          try {
            const u = new URL(targetUrl);
            resolved = `${u.protocol}//${u.host}/${href}`;
          } catch (e) {}
        }

        if (resolved.startsWith('http') || resolved.startsWith('vcos://')) {
          links.push({ href: resolved, text: text.slice(0, 60) });
        }
      }
    });

    log(`Discovered ${links.length} qualifying anchor links.`);
    log(`Indexing page contents into persistent local engine database...`);

    return {
      url: targetUrl,
      title,
      snippet: paragraphs[0]?.slice(0, 160) + (paragraphs[0]?.length > 160 ? "..." : "") || "Extracted bare-metal webpage view.",
      content: fullContent,
      paragraphs,
      links,
      indexedAt: Date.now()
    };
  };

  const handleManualCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crawlUrl.trim() || isCrawling) return;

    if (!isWifiConnected) {
      setCrawlLogs(prev => [...prev, `[ERROR] No network connection. Cannot initialize crawl.`]);
      return;
    }

    setIsCrawling(true);
    setCrawlLogs([]);
    kernel.emitEvent('TASK', `CRAWLER_MANUAL_INIT: ${crawlUrl}`);

    try {
      const crawled = await runLiveCrawl(crawlUrl, true);
      
      const filtered = dbPages.filter(p => p.url.toLowerCase() !== crawled.url.toLowerCase());
      const updated = [crawled, ...filtered];
      saveIndexToStorage(updated);
      
      setCrawlLogs(prev => [...prev, `\n[SUCCESS] Crawled and indexed "${crawled.title}" successfully!`]);
      setCrawlLogs(prev => [...prev, `[STATS] URL: ${crawled.url}`]);
      setCrawlLogs(prev => [...prev, `[STATS] Total database index size is now ${updated.length} pages.`]);
      setCrawlUrl('');
    } catch (err: any) {
      setCrawlLogs(prev => [...prev, `\n[CRAWL FAIL] ${err.message || 'Host is unreachable or blocks crawlers.'}`]);
    } finally {
      setIsCrawling(false);
    }
  };

  const goBack = () => {
    if (navStack.length > 0) {
      const previous = navStack[navStack.length - 1];
      setNavForwardStack(prev => [...prev, activeUrl || '']);
      setNavStack(prev => prev.slice(0, -1));
      setActiveUrl(previous);
      setQuery(previous);
      
      const p = dbPages.find(page => page.url.toLowerCase() === previous.toLowerCase());
      if (p) setReaderPage(p);
    } else {
      setActiveUrl(null);
      setReaderPage(null);
    }
  };

  const goForward = () => {
    if (navForwardStack.length > 0) {
      const next = navForwardStack[navForwardStack.length - 1];
      setNavStack(prev => [...prev, activeUrl || '']);
      setNavForwardStack(prev => prev.slice(0, -1));
      setActiveUrl(next);
      setQuery(next);
      
      const p = dbPages.find(page => page.url.toLowerCase() === next.toLowerCase());
      if (p) setReaderPage(p);
    }
  };

  const deleteFromIndex = (url: string) => {
    const updated = dbPages.filter(p => p.url !== url);
    saveIndexToStorage(updated);
    if (activeUrl === url) {
      setActiveUrl(null);
      setReaderPage(null);
    }
  };

  const resetIndexToDefaults = () => {
    if (window.confirm("Are you sure you want to reset the search database to system defaults? Any custom crawled pages will be removed.")) {
      saveIndexToStorage(DEFAULT_PAGES);
    }
  };

  return (
    <div className="h-full flex flex-col font-sans text-[12px] bg-[#1a1a1a] text-green-400 select-none">
      {/* Search Engine Header & Navigation Toolbar */}
      <div className="p-2 border-b border-green-900/40 bg-[#141414] flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="text-green-500" size={16} />
            <span className="font-bold tracking-tight uppercase text-green-500 text-[11px]">VC Bare-Metal Search Engine v2.0</span>
          </div>
          <div className="flex border border-green-900/50 rounded overflow-hidden">
            <button 
              onClick={() => setCurrentTab('search')} 
              className={`px-3 py-1 font-bold uppercase text-[9px] ${currentTab === 'search' ? 'bg-green-600 text-black' : 'bg-transparent text-green-400 hover:bg-green-900/10'}`}
            >
              Search Hub
            </button>
            <button 
              onClick={() => setCurrentTab('crawler')} 
              className={`px-3 py-1 font-bold uppercase text-[9px] ${currentTab === 'crawler' ? 'bg-green-600 text-black' : 'bg-transparent text-green-400 hover:bg-green-900/10'}`}
            >
              Crawler Core ({dbPages.length})
            </button>
          </div>
        </div>

        {currentTab === 'search' && (
          <div className="flex items-center gap-1.5">
            <button 
              className="p-1.5 border border-green-900/40 bg-black text-green-400 hover:bg-green-900/20 active:bg-green-900/40 disabled:opacity-30 disabled:hover:bg-black rounded" 
              disabled={!activeUrl && navStack.length === 0}
              onClick={goBack}
              title="Back"
            >
              <ArrowLeft size={13} />
            </button>
            <button 
              className="p-1.5 border border-green-900/40 bg-black text-green-400 hover:bg-green-900/20 active:bg-green-900/40 disabled:opacity-30 disabled:hover:bg-black rounded" 
              disabled={navForwardStack.length === 0}
              onClick={goForward}
              title="Forward"
            >
              <ArrowRight size={13} />
            </button>
            <button 
              className="p-1.5 border border-green-900/40 bg-black text-green-400 hover:bg-green-900/20 rounded" 
              onClick={() => activeUrl ? openUrlInReader(activeUrl) : handleSearch()}
              title="Refresh"
            >
              <RotateCw size={13} />
            </button>

            <div className="flex-1 flex items-center border border-green-900/50 bg-black px-2 py-1 gap-2 rounded">
              <Globe size={13} className="text-green-500" />
              <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex-1">
                <input 
                  type="text" 
                  className="w-full outline-none bg-transparent text-green-400 font-mono text-[11px]"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter search phrase, URL, or vcos:// link..."
                />
              </form>
            </div>

            <button 
              className="px-4 py-1 border border-green-900/50 bg-green-900/20 hover:bg-green-600 hover:text-black font-bold uppercase flex items-center gap-1 text-[10px] rounded"
              onClick={() => handleSearch()}
            >
              <Search size={12} />
              Query
            </button>
          </div>
        )}
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-hidden relative bg-black flex flex-col">
        {/* Wifi Interruption Guard */}
        {!isWifiConnected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-red-500 p-6">
            <WifiOff size={44} className="opacity-60 animate-pulse" />
            <h2 className="text-md font-bold uppercase tracking-wider">Interface Link Failure</h2>
            <p className="text-center text-[11px] text-zinc-500 max-w-sm">
              Internet connectivity is inactive. Please connect using your System Wifi Manager to enable the proxy tunneling crawler.
            </p>
          </div>
        ) : currentTab === 'search' ? (
          // Search Tab View
          <div className="flex-1 flex flex-col overflow-hidden">
            {loading ? (
              // Loading Spinner
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Terminal className="text-green-500 animate-spin" size={28} />
                <p className="font-mono text-[10px] uppercase tracking-widest text-green-600">Retrieving index records...</p>
              </div>
            ) : error ? (
              // Error Banner
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="border border-red-900/40 bg-red-950/20 p-4 max-w-md rounded text-center">
                  <AlertCircle size={32} className="text-red-500 mx-auto mb-2" />
                  <p className="font-mono text-red-400 font-bold text-[11px] uppercase">Engine Exception Detected</p>
                  <p className="text-zinc-400 text-[10px] mt-1">{error}</p>
                  <button 
                    onClick={() => setError(null)} 
                    className="mt-4 px-3 py-1 bg-red-900/30 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white text-[10px] font-mono rounded"
                  >
                    DISMISS
                  </button>
                </div>
              </div>
            ) : readerPage && activeUrl ? (
              // Renders in custom "Reader Mode" (no iframe embedding!)
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Reader Meta Banner */}
                <div className="bg-zinc-900/90 border-b border-green-900/30 px-4 py-2 flex items-center justify-between text-[10px] shrink-0">
                  <div className="flex items-center gap-1 text-green-500 font-mono">
                    <BookOpen size={12} />
                    <span>READER MODE ACTIVATED — BARE-METAL PARSED VIEW</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500">Indexed At: {new Date(readerPage.indexedAt).toLocaleDateString()}</span>
                    <button 
                      onClick={() => window.open(readerPage.url, '_blank')}
                      className="hover:text-green-300 flex items-center gap-1 font-mono text-green-500 underline text-[9px]"
                    >
                      Web Original <ExternalLink size={10} />
                    </button>
                  </div>
                </div>

                {/* Reader Text Body */}
                <div className="flex-1 overflow-y-auto p-6 md:p-10 select-text selection:bg-green-700 selection:text-black">
                  <div className="max-w-2xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="border-b border-green-900/30 pb-4">
                      <h1 className="text-2xl font-bold tracking-tight text-white mb-2 font-mono">{readerPage.title}</h1>
                      <p className="text-green-600 font-mono text-[10px] break-all">{readerPage.url}</p>
                    </div>

                    {/* Paragraphs */}
                    <div className="space-y-4 text-zinc-300 leading-relaxed text-[12.5px] font-mono">
                      {readerPage.paragraphs.map((para, idx) => (
                        <p key={idx} className="whitespace-pre-wrap">{para}</p>
                      ))}
                    </div>

                    {/* Extracted Outlinks */}
                    {readerPage.links && readerPage.links.length > 0 && (
                      <div className="mt-10 border-t border-green-900/30 pt-6">
                        <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-4 font-mono">Mapped Hypertext References:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {readerPage.links.map((link, idx) => (
                            <button
                              key={idx}
                              onClick={() => openUrlInReader(link.href)}
                              className="text-left p-2.5 rounded bg-zinc-900/30 border border-zinc-900 hover:border-green-800/30 hover:bg-green-950/10 group flex items-start gap-2"
                            >
                              <Globe size={11} className="text-green-600 mt-1 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-blue-400 group-hover:underline text-[11px] truncate">{link.text}</div>
                                <div className="text-[9px] text-zinc-500 truncate font-mono">{link.href}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : results.length > 0 ? (
              // Search Results List
              <div className="flex-1 overflow-y-auto p-4 select-text">
                <div className="max-w-2xl mx-auto space-y-5">
                  <div className="border-b border-green-900/20 pb-2 flex items-center justify-between text-[10px]">
                    <p className="text-green-600 font-mono">Found {results.length} documents matching search index filter.</p>
                    <p className="text-zinc-500 uppercase">Engine: VC.BM_v2</p>
                  </div>

                  <div className="space-y-6">
                    {results.map((res, i) => (
                      <div key={i} className="group border border-transparent hover:border-green-900/20 hover:bg-green-950/5 p-2 rounded transition-colors">
                        <button 
                          onClick={() => openUrlInReader(res.link)}
                          className="text-blue-400 hover:underline hover:text-blue-300 text-base font-bold text-left block w-full mb-1"
                        >
                          {res.title}
                        </button>
                        <p className="text-green-600 font-mono text-[10px] truncate mb-1">{res.link}</p>
                        <p className="text-zinc-400 text-[11.5px] leading-relaxed font-mono">{res.snippet}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[9px] bg-green-950/40 text-green-500 px-1.5 py-0.5 rounded font-mono border border-green-900/30">
                            SCORE: {res.score} pt
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Search Engine Homepage
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-green-950/20 border border-green-500/20 rounded-full flex items-center justify-center mb-4">
                  <Globe size={32} className="text-green-500 opacity-60" />
                </div>
                <div className="max-w-sm space-y-2">
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider font-mono">VC EXPLORER</h2>
                  <p className="text-zinc-500 text-[11px] leading-relaxed">
                    A fully custom bare-metal text search indexer. Crawl real sites, build a persistent local database, and query everything offline. No external scrapers or trackers.
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md">
                  <button 
                    onClick={() => { setQuery('vcos://welcome'); openUrlInReader('vcos://welcome'); }}
                    className="px-2.5 py-1 bg-zinc-900 border border-green-900/40 text-green-500 hover:bg-green-600 hover:text-black font-mono text-[10px] rounded"
                  >
                    vcos://welcome
                  </button>
                  <button 
                    onClick={() => { setQuery('operating system'); handleSearch(undefined, 'operating system'); }}
                    className="px-2.5 py-1 bg-zinc-900 border border-green-900/40 text-green-500 hover:bg-green-600 hover:text-black font-mono text-[10px] rounded"
                  >
                    "operating system"
                  </button>
                  <button 
                    onClick={() => { setQuery('kernel'); handleSearch(undefined, 'kernel'); }}
                    className="px-2.5 py-1 bg-zinc-900 border border-green-900/40 text-green-500 hover:bg-green-600 hover:text-black font-mono text-[10px] rounded"
                  >
                    "kernel"
                  </button>
                </div>

                {history.length > 0 && (
                  <div className="mt-8 text-left w-full max-w-xs border-t border-green-900/20 pt-4">
                    <p className="font-bold text-[9px] uppercase text-zinc-500 tracking-widest mb-2 font-mono">Recent Queries</p>
                    <div className="flex flex-wrap gap-2">
                      {history.map((h, i) => (
                        <button 
                          key={i} 
                          className="px-2 py-0.5 bg-zinc-900/60 border border-zinc-850 hover:border-green-900/50 hover:bg-zinc-800 text-[10px] font-mono text-zinc-400 rounded"
                          onClick={() => {
                            setQuery(h);
                            handleSearch(undefined, h);
                          }}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // Crawler Core tab
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-green-900/20 font-mono text-[11px]">
            {/* Left Column: Index Control & Web Crawler Input */}
            <div className="w-full md:w-1/2 p-4 flex flex-col gap-4 overflow-y-auto">
              <div>
                <h3 className="font-bold text-white uppercase text-[12px] flex items-center gap-1.5 mb-1.5 text-green-500">
                  <Terminal size={14} /> Web Crawling Console
                </h3>
                <p className="text-zinc-500 text-[10px] leading-relaxed">
                  Enter any public HTTP/HTTPS URL or custom system path. The VC crawler engine will dynamically fetch the payload, strip structural formatting, compile index tokens, and push to persistent local storage.
                </p>
              </div>

              {/* Crawler Form */}
              <form onSubmit={handleManualCrawl} className="flex gap-1.5 shrink-0">
                <input 
                  type="text" 
                  className="flex-1 bg-black border border-green-900/50 outline-none p-1.5 font-mono text-green-400 placeholder-green-900 text-[10.5px] rounded"
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                  placeholder="E.g., https://en.wikipedia.org/wiki/Web_crawler"
                  disabled={isCrawling}
                />
                <button 
                  type="submit"
                  className="px-4 bg-green-600 text-black font-bold uppercase hover:bg-green-500 active:bg-green-700 disabled:opacity-50 text-[10px] rounded shrink-0 flex items-center gap-1"
                  disabled={isCrawling || !crawlUrl.trim()}
                >
                  {isCrawling ? 'Crawling...' : 'Index'}
                </button>
              </form>

              {/* Logs Terminal */}
              <div className="flex-1 min-h-[140px] bg-black border border-green-900/40 p-3 flex flex-col rounded">
                <div className="border-b border-green-900/30 pb-1 mb-2 flex items-center justify-between text-[9px] text-zinc-500">
                  <span>Engine Logs</span>
                  <span className="animate-pulse text-green-600">{isCrawling ? '● CRAWL_EXECUTION' : '● IDLE'}</span>
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-[10px] text-green-500/80 space-y-1 select-text">
                  {crawlLogs.length === 0 ? (
                    <span className="text-zinc-600 italic">No logs on stack. Initiate crawls to view stream...</span>
                  ) : (
                    crawlLogs.map((log, i) => (
                      <div key={i} className="whitespace-pre-wrap leading-tight">{log}</div>
                    ))
                  )}
                  <div ref={logTerminalEndRef} />
                </div>
              </div>

              {/* Reset Control */}
              <div className="border-t border-green-900/20 pt-3 flex items-center justify-between">
                <span className="text-[10px] text-zinc-500">Total size: {dbPages.length} index pages</span>
                <button 
                  onClick={resetIndexToDefaults}
                  className="px-2.5 py-1 bg-red-950/20 border border-red-900/30 text-red-400 hover:bg-red-500 hover:text-white text-[10px] rounded uppercase font-bold"
                >
                  Reset Database
                </button>
              </div>
            </div>

            {/* Right Column: Database Records list */}
            <div className="w-full md:w-1/2 p-4 flex flex-col overflow-hidden">
              <h3 className="font-bold text-white uppercase text-[12px] flex items-center gap-1.5 mb-2 text-green-500">
                <Database size={14} /> Local Index Registry
              </h3>
              
              <div className="flex-1 border border-green-900/40 bg-black/40 overflow-y-auto rounded divide-y divide-green-900/20">
                {dbPages.map((page) => (
                  <div key={page.url} className="p-2.5 flex items-start gap-2 hover:bg-zinc-950 transition-colors">
                    <FileText size={14} className="text-green-600 mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-[11px] truncate">{page.title}</div>
                      <div className="text-[10px] text-green-600 truncate break-all">{page.url}</div>
                      <div className="text-[9px] text-zinc-500 mt-0.5">Scraped paragraphs: {page.paragraphs?.length || 0} | Links: {page.links?.length || 0}</div>
                    </div>
                    <button 
                      onClick={() => deleteFromIndex(page.url)}
                      className="p-1 text-red-500/50 hover:text-red-400 hover:bg-red-950/20 rounded"
                      title="Delete from index"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info & Connection Diagnostics */}
      <div className="bg-[#141414] border-t border-green-900/30 px-3 py-1 flex items-center justify-between text-[10px] text-green-700 font-mono shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>INDEX ACTIVE — {dbPages.length} WEBPAGES CACHED</span>
        </div>
        <div className="flex items-center gap-4">
          <span>PORT: 3000 (LOCAL)</span>
          <span>ZONE: SANDBOXED_OS</span>
        </div>
      </div>
    </div>
  );
};
