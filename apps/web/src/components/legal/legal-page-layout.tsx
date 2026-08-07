'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type Para = { style: string; text: string };

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildToc(content: Para[]): TocEntry[] {
  return content
    .filter((p) => p.style === 'Heading2' || p.style === 'Heading3')
    .map((p) => ({
      id: slugify(p.text),
      text: p.text,
      level: p.style === 'Heading2' ? 2 : 3,
    }));
}

// Detect consecutive key-value pairs (used for contact info / definition tables)
function detectPairs(content: Para[], start: number): number {
  const KEYS = [
    'Company number', 'Registered office', 'ICO registration number',
    'Privacy contact', 'General contact', 'EU representative',
    'Company Number', 'Website', 'Email',
  ];
  if (!KEYS.some((k) => content[start]?.text.startsWith(k))) return 0;
  let count = 0;
  let i = start;
  while (i < content.length && i - start < 20) {
    const cur = content[i];
    if (cur.style !== 'Normal') break;
    const isKey = KEYS.some((k) => cur.text.startsWith(k)) || (count % 2 === 0 && i + 1 < content.length && content[i + 1].style === 'Normal');
    if (!isKey && count > 0) break;
    count++;
    i++;
  }
  return count >= 2 ? count : 0;
}

// Detect numbered list items like "1. ...", "2. ...", "a) ...", "b) ..."
function isListItem(text: string): boolean {
  return /^(\d+\.|[a-z]\)|[a-z]\.)/.test(text.trim());
}

function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 z-50 h-1 transition-all duration-100"
      style={{ width: `${progress}%`, background: '#ea2e00' }}
      aria-hidden="true"
    />
  );
}

function TableOfContents({ entries, activeId }: { entries: TocEntry[]; activeId: string }) {
  if (entries.length === 0) return null;
  return (
    <nav aria-label="Table of contents">
      <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#7a6957' }}>
        Contents
      </p>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.id} style={{ paddingLeft: e.level === 3 ? '12px' : '0' }}>
            <a
              href={`#${e.id}`}
              className="block text-sm py-1 transition-colors duration-150 leading-snug"
              style={{
                color: activeId === e.id ? '#ea2e00' : '#7a6957',
                fontWeight: activeId === e.id ? '600' : '400',
                borderLeft: activeId === e.id ? '2px solid #ea2e00' : '2px solid transparent',
                paddingLeft: activeId === e.id ? (e.level === 3 ? '18px' : '8px') : (e.level === 3 ? '20px' : '10px'),
              }}
            >
              {e.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ContactInfoCard({ pairs }: { pairs: Para[] }) {
  const rows: { label: string; value: string }[] = [];
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    rows.push({ label: pairs[i].text, value: pairs[i + 1].text });
  }
  return (
    <div
      className="my-6 rounded-xl overflow-hidden border"
      style={{ borderColor: '#e8ddd3', background: '#fdf9f5' }}
    >
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex flex-col sm:flex-row"
          style={{ borderBottom: i < rows.length - 1 ? '1px solid #e8ddd3' : 'none' }}
        >
          <span
            className="text-xs font-semibold uppercase tracking-wider px-4 py-3 sm:w-52 sm:border-r flex-shrink-0"
            style={{ color: '#7a6957', borderColor: '#e8ddd3', background: '#f5ede3' }}
          >
            {r.label}
          </span>
          <span className="text-sm px-4 py-3" style={{ color: '#1b1410' }}>
            {r.value.startsWith('[') && r.value.endsWith(']') ? r.value.slice(1, -1) : r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function renderContent(content: Para[]) {
  const els: React.ReactNode[] = [];
  let i = 0;

  while (i < content.length) {
    const p = content[i];

    // Headings
    if (p.style === 'Heading2') {
      const id = slugify(p.text);
      els.push(
        <h2
          key={i}
          id={id}
          className="text-xl font-bold mt-12 mb-4 scroll-mt-24"
          style={{ color: '#1b1410', borderBottom: '2px solid #e8ddd3', paddingBottom: '8px', fontFamily: 'var(--font-display)' }}
        >
          {p.text}
        </h2>
      );
      i++;
      continue;
    }

    if (p.style === 'Heading3') {
      const id = slugify(p.text);
      els.push(
        <h3
          key={i}
          id={id}
          className="text-base font-semibold mt-8 mb-3 scroll-mt-24"
          style={{ color: '#3d2b1a' }}
        >
          {p.text}
        </h3>
      );
      i++;
      continue;
    }

    // Contact info / key-value card detection
    const pairCount = detectPairs(content, i);
    if (pairCount >= 2) {
      els.push(<ContactInfoCard key={i} pairs={content.slice(i, i + pairCount)} />);
      i += pairCount;
      continue;
    }

    // Definitions table detection — term/meaning pairs after "1. Definitions" heading
    if (
      p.style === 'Normal' &&
      p.text.startsWith('"') &&
      i + 1 < content.length &&
      content[i + 1].style === 'Normal' &&
      !content[i + 1].text.startsWith('"')
    ) {
      // Collect all definition pairs
      const defs: { term: string; meaning: string }[] = [];
      while (
        i < content.length &&
        content[i].style === 'Normal' &&
        content[i].text.startsWith('"') &&
        i + 1 < content.length &&
        content[i + 1].style === 'Normal'
      ) {
        defs.push({ term: content[i].text, meaning: content[i + 1].text });
        i += 2;
      }
      if (defs.length > 0) {
        els.push(
          <div
            key={`defs-${i}`}
            className="my-6 rounded-xl overflow-hidden border"
            style={{ borderColor: '#e8ddd3' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#f5ede3' }}>
                  <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wider" style={{ color: '#7a6957', width: '35%' }}>Term</th>
                  <th className="text-left px-4 py-2 font-semibold text-xs uppercase tracking-wider" style={{ color: '#7a6957' }}>Meaning</th>
                </tr>
              </thead>
              <tbody>
                {defs.map((d, di) => (
                  <tr key={di} style={{ borderTop: '1px solid #e8ddd3', background: di % 2 === 0 ? '#fdf9f5' : '#fff' }}>
                    <td className="px-4 py-3 font-medium align-top" style={{ color: '#3d2b1a' }}>{d.term}</td>
                    <td className="px-4 py-3 align-top" style={{ color: '#4a3728' }}>{d.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Numbered list items — group consecutive ones
    if (p.style === 'Normal' && isListItem(p.text)) {
      const items: string[] = [];
      while (i < content.length && content[i].style === 'Normal' && isListItem(content[i].text)) {
        items.push(content[i].text);
        i++;
      }
      els.push(
        <ul key={`list-${i}`} className="my-4 space-y-2">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-3 leading-relaxed" style={{ color: '#4a3728' }}>
              <span className="flex-shrink-0 font-medium" style={{ color: '#ea2e00', minWidth: '1.5rem' }}>
                {item.match(/^(\d+\.|[a-z][.)]) /)?.[1] ?? '•'}
              </span>
              <span>{item.replace(/^(\d+\.|[a-z][.)])\s*/, '')}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Callout paragraphs — short critical statements
    const isCritical =
      p.style === 'Normal' &&
      p.text.length < 220 &&
      /emergency|never post|ban|not an emergency service|do not accept these terms/i.test(p.text);

    if (isCritical) {
      els.push(
        <div
          key={i}
          className="my-4 rounded-lg px-5 py-4 border-l-4 text-sm leading-relaxed"
          style={{ borderColor: '#ea2e00', background: '#fff5f2', color: '#3d2b1a' }}
        >
          {p.text}
        </div>
      );
      i++;
      continue;
    }

    // Skip standalone "Term" / "Meaning" headers from the definition table
    if (p.style === 'Normal' && (p.text === 'Term' || p.text === 'Meaning')) {
      i++;
      continue;
    }

    // Regular paragraph
    els.push(
      <p key={i} className="mb-4 leading-[1.75] text-base" style={{ color: '#4a3728' }}>
        {p.text}
      </p>
    );
    i++;
  }

  return els;
}

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  version: string;
  applies?: string;
  content: Para[];
  otherLink: { href: string; label: string };
}

export default function LegalPageLayout({
  title,
  lastUpdated,
  version,
  applies,
  content,
  otherLink,
}: LegalPageLayoutProps) {
  const toc = buildToc(content);
  const [activeId, setActiveId] = useState('');
  const [mobileTocOpen, setMobileTocOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    document.querySelectorAll('h2[id], h3[id]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <ReadingProgress />

      <div className="min-h-screen" style={{ background: '#faf7f4' }}>
        {/* Header */}
        <header
          className="sticky top-0 z-40 border-b"
          style={{ background: 'rgba(240,231,214,0.95)', backdropFilter: 'blur(8px)', borderColor: '#e8ddd3' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Link href="/" className="flex items-center gap-2 flex-shrink-0">
                <Image src="/logo.png" alt="TheWileyfox" width={28} height={28} className="object-contain" />
              </Link>
              <span className="text-[#e8ddd3] hidden sm:block">|</span>
              <h1
                className="text-base font-semibold truncate"
                style={{ color: '#1b1410', fontFamily: 'var(--font-display)' }}
              >
                {title}
              </h1>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Mobile TOC toggle */}
              <button
                onClick={() => setMobileTocOpen((v) => !v)}
                className="lg:hidden text-sm px-3 py-1.5 rounded-lg border transition-colors"
                style={{ borderColor: '#d4c4b0', color: '#7a6957', background: mobileTocOpen ? '#e8ddd3' : 'transparent' }}
                aria-expanded={mobileTocOpen}
                aria-label="Toggle table of contents"
              >
                Contents
              </button>
              <Link
                href="/"
                className="text-sm transition-colors hover:text-[#ea2e00] hidden sm:block"
                style={{ color: '#7a6957' }}
              >
                ← Home
              </Link>
            </div>
          </div>

          {/* Mobile TOC dropdown */}
          {mobileTocOpen && (
            <div
              className="lg:hidden border-t px-4 py-4 max-h-64 overflow-y-auto"
              style={{ background: '#f5ede3', borderColor: '#e8ddd3' }}
            >
              <TableOfContents entries={toc} activeId={activeId} />
            </div>
          )}
        </header>

        {/* Hero banner */}
        <div
          className="border-b"
          style={{ background: 'linear-gradient(135deg, #f0e7d6 0%, #f5ede3 100%)', borderColor: '#e8ddd3' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-xs font-semibold uppercase tracking-widest px-2 py-1 rounded"
                  style={{ background: '#ea2e00', color: '#fff' }}
                >
                  Legal
                </span>
                <span className="text-xs" style={{ color: '#9d8c7a' }}>Version {version}</span>
              </div>
              <h1
                className="text-3xl sm:text-4xl font-bold mb-3 leading-tight"
                style={{ color: '#1b1410', fontFamily: 'var(--font-display)' }}
              >
                {title}
              </h1>
              {applies && (
                <p className="text-sm mb-2 leading-relaxed" style={{ color: '#7a6957' }}>{applies}</p>
              )}
              <p className="text-sm" style={{ color: '#9d8c7a' }}>
                Last updated: <strong style={{ color: '#7a6957' }}>{lastUpdated}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex gap-12">
            {/* Sticky TOC sidebar — desktop only */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24">
                <TableOfContents entries={toc} activeId={activeId} />
              </div>
            </aside>

            {/* Main content */}
            <main
              className="flex-1 min-w-0"
              style={{ maxWidth: '68ch' }}
            >
              {renderContent(content)}

              {/* Footer nav */}
              <div
                className="mt-16 pt-8 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                style={{ borderColor: '#e8ddd3' }}
              >
                <div className="text-sm" style={{ color: '#9d8c7a' }}>
                  © {new Date().getFullYear()} TheWileyfox. All rights reserved.
                </div>
                <div className="flex gap-4 text-sm">
                  <Link href={otherLink.href} className="transition-colors hover:text-[#ea2e00]" style={{ color: '#7a6957' }}>
                    {otherLink.label}
                  </Link>
                  <Link href="/pricing" className="transition-colors hover:text-[#ea2e00]" style={{ color: '#7a6957' }}>
                    Pricing
                  </Link>
                  <Link href="/" className="transition-colors hover:text-[#ea2e00]" style={{ color: '#7a6957' }}>
                    Home
                  </Link>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
