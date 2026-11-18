'use client';

import { useEffect, useRef } from 'react';

interface ColorStop {
  pct: number;
  p: string;
  s: string;
  t: string;
}

const COLOR_STOPS: ColorStop[] = [
  { pct: 0.00, p: '#6366F1', s: '#06B6D4', t: '#8B5CF6' },
  { pct: 0.28, p: '#10B981', s: '#6366F1', t: '#06B6D4' },
  { pct: 0.60, p: '#F43F5E', s: '#8B5CF6', t: '#F59E0B' },
  { pct: 0.88, p: '#4F46E5', s: '#38BDF8', t: '#10B981' }
];

export function AmbientOrbs() {
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;

    function handleScroll() {
      const scrollY = window.scrollY || window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, scrollY / docHeight)) : 0;

      const orb1Y = scrollY * 0.52;
      const orb1X = Math.sin(progress * Math.PI * 1.6) * -220;

      const orb2Y = scrollY * 0.72;
      const orb2X = Math.sin(progress * Math.PI * 1.6) * 260;

      const orb3Y = scrollY * 0.42;
      const orb3X = Math.cos(progress * Math.PI) * 160;

      if (orb1Ref.current) {
        orb1Ref.current.style.transform = `translate3d(${orb1X}px, ${orb1Y}px, 0)`;
      }
      if (orb2Ref.current) {
        orb2Ref.current.style.transform = `translate3d(${orb2X}px, ${orb2Y}px, 0)`;
      }
      if (orb3Ref.current) {
        orb3Ref.current.style.transform = `translate3d(${orb3X}px, ${orb3Y}px, 0)`;
      }

      let activeStage = COLOR_STOPS[0];
      for (let i = 0; i < COLOR_STOPS.length; i++) {
        if (progress >= COLOR_STOPS[i].pct) {
          activeStage = COLOR_STOPS[i];
        }
      }

      if (orb1Ref.current) orb1Ref.current.style.backgroundColor = activeStage.p;
      if (orb2Ref.current) orb2Ref.current.style.backgroundColor = activeStage.s;
      if (orb3Ref.current) orb3Ref.current.style.backgroundColor = activeStage.t;

      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(handleScroll);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] glow-radial opacity-70" />
      <div
        ref={orb1Ref}
        className="absolute w-[600px] h-[600px] rounded-full blur-[140px] opacity-25 will-change-transform"
        style={{ backgroundColor: '#6366F1', top: '80px', right: '-100px' }}
      />
      <div
        ref={orb2Ref}
        className="absolute w-[520px] h-[520px] rounded-full blur-[140px] opacity-20 will-change-transform"
        style={{ backgroundColor: '#06B6D4', top: '380px', left: '-100px' }}
      />
      <div
        ref={orb3Ref}
        className="absolute w-[500px] h-[500px] rounded-full blur-[160px] opacity-15 will-change-transform"
        style={{ backgroundColor: '#8B5CF6', top: '800px', right: '20%' }}
      />
    </div>
  );
}
