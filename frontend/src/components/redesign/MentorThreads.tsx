'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type Dispatch, type RefObject, type SetStateAction } from 'react';

type Screenshot = { name: string; url: string };
type Turn = { question: string; answer: string; screenshot?: Screenshot };


type Thread = {
  turns: Turn[];
  question: string;
  screenshot?: Screenshot;
  sending?: string;
  reading?: boolean;
  error?: string;
};

export const emptyThread: Thread = { turns: [], question: '' };

type Threads = Record<string, Thread>;
const Context = createContext<{
  threads: Threads;
  setThreads: Dispatch<SetStateAction<Threads>>;
  requests: RefObject<Map<string, AbortController>>;
} | null>(null);

export function MentorThreads({ account, children }: { account: string; children: ReactNode }) {
  const key = 'stepflow-mentor-v1:' + account;
  const [threads, setThreads] = useState<Threads>(() => {
    try { return JSON.parse(sessionStorage.getItem(key) || '{}') ?? {}; }
    catch { return {}; }
  });
  const requests = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const active = requests.current;
    return () => { for (const controller of active.values()) controller.abort(); };
  }, []);
  useEffect(() => {
    if (!account) return;
    // Keep images in memory. Large attachments must not displace the text history.
    const saved = Object.fromEntries(Object.entries(threads).map(([id, thread]) => [id, {
      question: thread.sending || thread.question,
      turns: thread.turns.map(({ question, answer }) => ({ question, answer })),
    }]));
    try { sessionStorage.setItem(key, JSON.stringify(saved)); } catch { /* In-memory history stays available. */ }
  }, [account, key, threads]);
  return <Context.Provider value={{ threads, setThreads, requests }}>{children}</Context.Provider>;
}

export function useMentorThreads() {
  const context = useContext(Context);
  if (!context) throw new Error('Missing MentorThreads');
  return context;
}
export type { Thread };
