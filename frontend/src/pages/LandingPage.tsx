import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { api } from '../services/api';
import { usePageMetadata } from '../lib/usePageMetadata';
import '../styles/cit-landing.css';
import { 
  ACCOUNTS_DATA, 
  ROLE_RULES, 
  ALL_ACCOUNTS, 
  findMatchingAccount, 
  type AccountItem, 
  type RoleCategoryKey 
} from '../lib/accountsData';

type RoleKey = 'admin' | 'coordinator' | 'faculty' | 'club';

interface PublicStats {
  sessions_scheduled: number;
  hard_violations: number;
  booking_score: number;
  bookings_count: number;
  last_reschedule_moved_count: number;
}

export const LandingPage: React.FC = () => {
  usePageMetadata(
    'CIT Campus Timetable & Venue Management | Zero Clashes',
    'Chilika Institute of Technology timetable solver and venue management platform. 189 sessions, 27 rooms, midsem exams, and zero timetable collisions.'
  );

  const { login } = useAuth();
  const navigate = useNavigate();

  // Modal and submission state
  const [modalOpen, setModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [manualIdentifier, setManualIdentifier] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeRoleLoggingIn, setActiveRoleLoggingIn] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeDirectoryTab, setActiveDirectoryTab] = useState<'all' | RoleCategoryKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'form' | 'directory'>('form');
  const [isFormHighlighted, setIsFormHighlighted] = useState(false);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileNavOpen(false);
        setModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live stats from backend
  const [stats, setStats] = useState<PublicStats | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Computed detected account based on typed identifier
  const detectedAccount = findMatchingAccount(manualIdentifier);

  // Fetch live stats from backend
  useEffect(() => {
    let active = true;
    api.get('/public/stats')
      .then(res => {
        if (active && res.data) {
          setStats(res.data);
        }
      })
      .catch(() => {
        // Fallback to default values
      });
    return () => {
      active = false;
    };
  }, []);

  // Open modal directly with optional role filter preset
  const openRoleModal = (role?: RoleCategoryKey) => {
    if (role) {
      setActiveDirectoryTab(role);
      if (role === 'faculty') {
        setManualIdentifier('F06');
        setManualPassword('F06@123');
      } else if (role === 'coordinator') {
        setManualIdentifier('CSE');
        setManualPassword('Coord@CSE123');
      } else if (role === 'club') {
        setManualIdentifier('dance');
        setManualPassword('Club@Dance123');
      } else if (role === 'admin') {
        setManualIdentifier('admin');
        setManualPassword('Admin@123');
      }
    } else {
      setActiveDirectoryTab('all');
    }
    setSearchQuery('');
    setLoginError(null);
    setMobileView('form');
    setModalOpen(true);
  };

  // Quick fill form credentials from a preset chip or directory member
  const fillFormCredentials = (ident: string, pass: string) => {
    setManualIdentifier(ident);
    setManualPassword(pass);
    setLoginError(null);
    setMobileView('form');
    setIsFormHighlighted(true);
    setTimeout(() => setIsFormHighlighted(false), 1200);
  };

  // Handle direct role login (opens modal to that role for full member selection)
  const handleRoleLogin = async (role: RoleKey) => {
    openRoleModal(role as RoleCategoryKey);
  };

  // Handle 1-click login for any of the 62 accounts
  const handleAccountLogin = async (acc: AccountItem) => {
    setIsLoggingIn(true);
    setLoginError(null);
    setActiveRoleLoggingIn(acc.name);

    try {
      const userData = await login(acc.email, acc.password);
      setModalOpen(false);
      if (userData.role === 'admin') {
        navigate('/');
      } else if (userData.role === 'department_coordinator') {
        navigate('/timetable');
      } else if (userData.role === 'faculty') {
        navigate('/timetable');
      } else if (userData.role === 'club') {
        navigate('/bookings');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error('Account login failed:', err);
      setLoginError(err.response?.data?.detail || 'Authentication failed. Please verify the backend is running.');
      setIsLoggingIn(false);
      setActiveRoleLoggingIn(null);
    }
  };

  // Handle manual login from modal form
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ident = manualIdentifier.trim();
    if (!ident || !manualPassword) {
      setLoginError('Please enter both identifier (email or ID) and password.');
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    setActiveRoleLoggingIn(ident);

    try {
      const userData = await login(ident, manualPassword);
      setModalOpen(false);
      if (userData.role === 'admin') {
        navigate('/');
      } else if (userData.role === 'department_coordinator') {
        navigate('/timetable');
      } else if (userData.role === 'faculty') {
        navigate('/timetable');
      } else if (userData.role === 'club') {
        navigate('/bookings');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error('Manual login failed:', err);
      setLoginError(err.response?.data?.detail || 'Invalid email/ID or password.');
      setIsLoggingIn(false);
      setActiveRoleLoggingIn(null);
    }
  };

  // Three.js, Lenis, and Landing Animation Script Integration
  useEffect(() => {
    let unmounted = false;
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = mq.matches;
    let scene: any = null;
    let lenis: any = null;
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    let finished = false;
    let skipped = false;
    let failed = false;
    let running = false;
    let bellFired = false;
    let scrollDirty = true;
    let viewportDirty = true;
    let storyEnd = 1;
    let docEnd = 1;
    let cameraProgress = 0;
    let fpsTime = 0;
    let fpsFrames = 0;
    let quality = 0;
    let audio: any = null;
    let sound = false;
    let hiddenAt = 0;

    const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
    const ease = (x: number) => {
      x = clamp(x);
      return x * x * (3 - 2 * x);
    };

    const $ = (id: string) => document.getElementById(id);
    const loader = $('loader') as HTMLDivElement | null;
    const loadProgress = $('load-progress') as HTMLProgressElement | null;
    const loadValue = $('load-value') as HTMLElement | null;
    const controls = $('controls') as HTMLDivElement | null;
    const skip = $('skip') as HTMLButtonElement | null;
    const title = $('title') as HTMLHeadingElement | null;
    const cap = $('cap-text') as HTMLElement | null;
    const progressEl = $('progress') as HTMLDivElement | null;
    const flashEl = $('flash') as HTMLDivElement | null;
    const reBtn = $('re') as HTMLButtonElement | null;
    const soundBtn = $('sound') as HTMLButtonElement | null;
    const stagePin = $('stage-pin') as HTMLDivElement | null;
    const storyEl = $('story') as HTMLElement | null;

    const navLinks = Array.from(document.querySelectorAll('[data-nav]')) as HTMLElement[];
    const navSections = navLinks.map(a => document.querySelector(a.getAttribute('href') || '')) as (HTMLElement | null)[];
    const navOffsets = new Float64Array(navLinks.length);
    const storySteps = Array.from(document.querySelectorAll('.story-step')) as HTMLElement[];
    const stepOffsets = new Float64Array(storySteps.length);

    const tyEl = $('ty');
    const ty = tyEl ? tyEl.firstElementChild as HTMLElement : null;
    const chips = $('ch') as HTMLElement | null;
    const line = 'seminar hall kal shaam 6 baje, 2 ghante, 100 log, mic chahiye';
    const typed = Array.from({ length: line.length + 1 }, (_, i) => line.slice(0, i));
    let typeIndex = -1;
    let activeNav = -2;
    let oldProgress = -1;

    const counters = Array.from(document.querySelectorAll('.nums b, .big b')).map(el => ({
      el: el as HTMLElement,
      target: Number(el.textContent) || 0,
      start: -1,
      last: -1,
      visible: false
    }));

    const scrambleChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const scrambles = Array.from(document.querySelectorAll('.k')).map(el => {
      const text = el.textContent || '';
      const frames: string[] = [];
      el.setAttribute('aria-label', text);
      for (let f = 0; f < 18; f++) {
        let v = '';
        for (let j = 0; j < text.length; j++) {
          v += j < (f / 17) * text.length ? text[j] : text[j] === ' ' ? ' ' : scrambleChars[(j * 11 + f * 7) % scrambleChars.length];
        }
        frames.push(v);
      }
      frames.push(text);
      return { el: el as HTMLElement, text, start: -1, last: -1, frames };
    });

    // Build letter sweep masks for Title
    if (title) {
      title.textContent = '';
      let letterIndex = 0;
      for (const word of ['CIT', 'Schedule']) {
        const w = document.createElement('span');
        w.className = 'word';
        w.setAttribute('aria-hidden', 'true');
        for (const char of word) {
          const mask = document.createElement('span');
          const l = document.createElement('span');
          mask.className = 'mask';
          l.className = 'letter';
          l.textContent = char;
          l.style.setProperty('--delay', `${letterIndex++ * 45}ms`);
          mask.append(l);
          w.append(mask);
        }
        title.append(w);
        if (word === 'CIT') title.append(document.createTextNode(' '));
      }
    }

    const headings = Array.from(document.querySelectorAll('h2')) as HTMLHeadingElement[];
    for (const h of headings) {
      h.dataset.original = h.textContent || '';
    }

    function splitLines() {
      for (const h of headings) {
        const seen = h.classList.contains('seen');
        const words = (h.dataset.original || '').split(' ');
        h.textContent = '';
        const spans: HTMLSpanElement[] = [];
        for (const w of words) {
          const s = document.createElement('span');
          s.textContent = w + ' ';
          s.style.whiteSpace = 'nowrap';
          h.append(s);
          spans.push(s);
        }
        const lines: string[][] = [];
        let top = -1;
        for (const s of spans) {
          if (Math.abs(s.offsetTop - top) > 3) {
            lines.push([]);
            top = s.offsetTop;
          }
          lines[lines.length - 1].push(s.textContent || '');
        }
        h.textContent = '';
        h.setAttribute('aria-label', h.dataset.original || '');
        for (let i = 0; i < lines.length; i++) {
          const mask = document.createElement('span');
          const inner = document.createElement('span');
          mask.className = 'line-mask';
          mask.setAttribute('aria-hidden', 'true');
          inner.className = 'line-inner';
          inner.style.setProperty('--line-delay', `${i * 90}ms`);
          inner.textContent = lines[i].join('').trim();
          mask.append(inner);
          h.append(mask);
        }
        h.classList.add('reveal');
        if (seen || reduced) h.classList.add('seen');
      }
    }

    let observer: IntersectionObserver | null = null;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if ((e.target as HTMLElement).tagName === 'H2') {
            (e.target as HTMLElement).classList.add('seen');
          }
          for (const c of counters) {
            if (c.el === e.target) c.visible = true;
          }
          for (const s of scrambles) {
            if (s.el === e.target && s.start < 0) s.start = performance.now();
          }
          observer?.unobserve(e.target);
        }
      }, { threshold: 0.15 });

      for (const h of headings) observer.observe(h);
      for (const c of counters) observer.observe(c.el);
      for (const s of scrambles) observer.observe(s.el);
      root.classList.add('motion-ready');
    } else {
      for (const c of counters) c.visible = true;
    }

    function measure() {
      if (!storyEl) return;
      splitLines();
      storyEnd = storyEl.offsetHeight - window.innerHeight;
      docEnd = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      for (let i = 0; i < navSections.length; i++) {
        const sec = navSections[i];
        if (sec) navOffsets[i] = sec.getBoundingClientRect().top + window.scrollY;
      }
      for (let i = 0; i < storySteps.length; i++) {
        stepOffsets[i] = storySteps[i].offsetTop;
      }
      scene?.resize();
      lenis?.resize();
      viewportDirty = false;
      scrollDirty = true;
    }

    if (document.fonts) {
      document.fonts.ready.then(() => {
        viewportDirty = true;
      });
    }

    const onResize = () => { viewportDirty = true; };
    const onScroll = () => {
      scrollDirty = true;
      if (running && window.scrollY > window.innerHeight * 0.35) finishIntro(false);
    };

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    function setLoad(n: number) {
      if (loadProgress) loadProgress.value = n;
      if (loadValue) loadValue.textContent = n + '%';
    }

    function showTitle() {
      root.classList.add('title-on');
    }

    function finishIntro(focus: boolean) {
      skipped = true;
      finished = true;
      running = false;
      elapsed = 20;
      root.classList.remove('intro-running', 'ringing');
      showTitle();
      if (loader) loader.hidden = true;
      if (controls) controls.hidden = true;
      if (cap) cap.textContent = '9:00 am. Everyone finds their place.';
      scene?.finish();
      if (focus) {
        const firstLink = $('rl')?.querySelector('a, button') as HTMLElement | null;
        firstLink?.focus({ preventScroll: true });
      }
    }

    function fallback() {
      failed = true;
      running = false;
      root.classList.remove('webgl', 'intro-running', 'ringing');
      showTitle();
      if (controls) controls.hidden = true;
      if (loader) loader.hidden = true;
      scene?.dispose();
      scene = null;
      const canvas = stagePin?.querySelector('canvas');
      if (canvas) canvas.remove();
      if (reBtn) reBtn.disabled = true;
    }

    if (skip) skip.addEventListener('click', () => finishIntro(true));
    if (reBtn) {
      reBtn.addEventListener('click', () => {
        if (!scene || reduced) return;
        if (lenis) lenis.scrollTo(0, { immediate: true });
        else window.scrollTo(0, 0);
        elapsed = 0;
        finished = skipped = bellFired = false;
        running = true;
        root.classList.remove('title-on', 'ringing');
        root.classList.add('intro-running');
        if (cap) cap.textContent = 'Monday, 8:55 am. 1,000 students, 27 rooms, one timetable.';
        if (controls) controls.hidden = false;
        skip?.focus({ preventScroll: true });
        scene.reset();
      });
    }

    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        try {
          if (!audio) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            audio = new AudioCtx();
          }
          audio.resume();
          sound = !sound;
          soundBtn.setAttribute('aria-pressed', String(sound));
          soundBtn.textContent = sound ? 'Sound on' : 'Sound off';
        } catch {
          sound = false;
          soundBtn.disabled = true;
        }
      });
    }

    function ringBell() {
      bellFired = true;
      if (cap) cap.textContent = '9:00 am. Everyone finds their place.';
      root.classList.add('ringing');
      if (!sound || !audio) return;
      const now = audio.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.frequency.value = 880 * (i === 0 ? 1 : i === 1 ? 2.76 : 5.4);
        gain.gain.setValueAtTime(0.07 / (i + 1), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(now);
        osc.stop(now + 1.8);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      }
    }

    // Smooth scroll for internal hash links
    const internalAnchors = Array.from(document.querySelectorAll('a[href^="#"]')) as HTMLAnchorElement[];
    const anchorHandlers: { anchor: HTMLAnchorElement; handler: (e: MouseEvent) => void }[] = [];
    for (const a of internalAnchors) {
      const handler = (e: MouseEvent) => {
        const target = document.querySelector(a.getAttribute('href') || '') as HTMLElement | null;
        if (!target) return;
        e.preventDefault();
        if (running) finishIntro(false);
        if (lenis) lenis.scrollTo(target, { offset: -112 });
        else target.scrollIntoView({ behavior: 'auto', block: 'start' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      };
      a.addEventListener('click', handler);
      anchorHandlers.push({ anchor: a, handler });
    }

    // Button magnetic hover effect
    const fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    const btnMoveCleanups: (() => void)[] = [];
    if (fine) {
      const btns = Array.from(document.querySelectorAll('.btn')) as HTMLElement[];
      for (const b of btns) {
        const onMove = (e: PointerEvent) => {
          if (reduced) return;
          const r = b.getBoundingClientRect();
          b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.12}px, ${(e.clientY - r.top - r.height / 2) * 0.15}px)`;
        };
        const onLeave = () => { b.style.transform = ''; };
        b.addEventListener('pointermove', onMove);
        b.addEventListener('pointerleave', onLeave);
        b.addEventListener('blur', onLeave);
        btnMoveCleanups.push(() => {
          b.removeEventListener('pointermove', onMove);
          b.removeEventListener('pointerleave', onLeave);
          b.removeEventListener('blur', onLeave);
        });
      }
    }

    function ui(now: number) {
      if (viewportDirty) measure();
      if (scrollDirty) {
        const y = window.scrollY;
        cameraProgress = clamp(y / storyEnd);
        const p = Math.round(clamp(y / docEnd) * 1000);
        if (p !== oldProgress && progressEl) {
          progressEl.style.transform = `scaleX(${p / 1000})`;
          oldProgress = p;
        }
        let idx = -1;
        for (let i = 0; i < navOffsets.length; i++) {
          if (y + window.innerHeight * 0.4 >= navOffsets[i]) idx = i;
        }
        if (idx !== activeNav) {
          for (let i = 0; i < navLinks.length; i++) {
            if (i === idx) navLinks[i].setAttribute('aria-current', 'location');
            else navLinks[i].removeAttribute('aria-current');
          }
          activeNav = idx;
        }
        const count = reduced || failed ? line.length : Math.floor(clamp((y + window.innerHeight * 0.8 - stepOffsets[1]) / (window.innerHeight * 0.5)) * line.length);
        if (count !== typeIndex) {
          typeIndex = count;
          if (ty) ty.textContent = typed[count];
          if (chips) chips.style.visibility = count === line.length ? 'visible' : 'hidden';
        }
        scrollDirty = false;
      }
      for (const c of counters) {
        if (!c.visible || c.last === c.target) continue;
        if (c.start < 0) c.start = now;
        const v = reduced ? c.target : Math.round(c.target * (1 - Math.pow(1 - clamp((now - c.start) / 1100), 3)));
        if (v !== c.last) {
          c.el.textContent = String(v);
          c.last = v;
        }
      }
      for (const s of scrambles) {
        if (s.start < 0 || s.last === 18) continue;
        const f = reduced ? 18 : Math.min(18, Math.floor((now - s.start) / 35));
        if (f !== s.last) {
          s.el.textContent = s.frames[f];
          s.last = f;
        }
      }
    }

    function frame(now: number) {
      raf = 0;
      if (document.hidden || unmounted) return;
      const raw = last ? (now - last) / 1000 : 1 / 60;
      const dt = Math.min(raw, 0.05);
      last = now;

      try {
        lenis?.raf(now);
        ui(now);
        if (scene && !failed && storyEl) {
          if (running) {
            elapsed += Math.min(raw, 0.5);
            if (elapsed >= 3.8 && !bellFired) ringBell();
            if (elapsed >= 4.35) showTitle();
            if (elapsed >= 13) finishIntro(false);
          }
          if (window.scrollY < storyEl.offsetHeight && (!reduced || scene.dirty)) {
            scene.update(dt, elapsed, cameraProgress, reduced);
            scene.dirty = false;
            if (!reduced) {
              fpsTime += raw;
              fpsFrames++;
              if (fpsTime >= 3) {
                if (fpsFrames / fpsTime < 45 && quality < 2) {
                  quality++;
                  scene.degrade(quality);
                }
                fpsTime = 0;
                fpsFrames = 0;
              }
            }
          }
        }
      } catch (error) {
        fallback();
      }

      if (!unmounted) {
        raf = requestAnimationFrame(frame);
      }
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = performance.now();
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        audio?.suspend();
      } else {
        const gap = performance.now() - hiddenAt;
        for (const c of counters) if (c.start >= 0) c.start += gap;
        for (const s of scrambles) if (s.start >= 0) s.start += gap;
        last = 0;
        fpsTime = fpsFrames = 0;
        if (sound) audio?.resume();
        if (!raf && !unmounted) raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onMqChange = (e: MediaQueryListEvent) => {
      reduced = e.matches;
      if (reduced) {
        lenis?.destroy();
        lenis = null;
        finishIntro(false);
        if (reBtn) reBtn.disabled = true;
        for (const h of headings) h.classList.add('seen');
      } else {
        const LenisClass = (window as any).Lenis;
        if (LenisClass && !failed) lenis = new LenisClass({ autoRaf: false, duration: 1.1, smoothWheel: true });
        if (reBtn) reBtn.disabled = !scene;
      }
      scrollDirty = true;
      if (scene) scene.dirty = true;
    };
    mq.addEventListener('change', onMqChange);

    function loadScript(url: string): Promise<void> {
      return new Promise((resolve, reject) => {
        // If already loaded
        if (url.includes('three') && (window as any).THREE) return resolve();
        if (url.includes('lenis') && (window as any).Lenis) return resolve();

        const script = document.createElement('script');
        const timeout = setTimeout(() => {
          script.remove();
          reject(new Error('CDN timeout'));
        }, 12000);
        script.src = url;
        script.crossOrigin = 'anonymous';
        script.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        script.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('CDN unavailable'));
        };
        document.head.append(script);
      });
    }

    function createScene() {
      const T = (window as any).THREE;
      const palette = [0x6f8fb8, 0x5fa8a0, 0xc9a96b, 0xc27d5e, 0x8f86b8];
      const mobile = window.innerWidth < 650;
      const maxN = mobile ? 75 : 130;
      let count = maxN;
      let time = 0;
      let final = false;

      const surface = document.createElement('canvas');
      const gl = surface.getContext('webgl2', { antialias: true, alpha: false }) ||
                 surface.getContext('webgl', { antialias: true, alpha: false });
      if (!gl) throw new Error('WebGL unavailable');

      const renderer = new T.WebGLRenderer({
        canvas: surface,
        context: gl,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x0a1220);
      renderer.outputEncoding = T.sRGBEncoding;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = T.PCFSoftShadowMap;

      renderer.domElement.setAttribute('aria-hidden', 'true');
      stagePin?.prepend(renderer.domElement);

      renderer.domElement.addEventListener('webglcontextlost', (e: any) => {
        e.preventDefault();
        fallback();
      });

      const world = new T.Scene();
      world.fog = new T.Fog(0x0a1220, 40, 100);

      const cam = new T.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 160);
      world.add(new T.HemisphereLight(0xe2e9f2, 0x172032, 0.85));

      const sun = new T.DirectionalLight(0xffe7c1, 1.05);
      sun.position.set(-8, 25, 12);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -22;
      sun.shadow.camera.right = 22;
      sun.shadow.camera.top = 25;
      sun.shadow.camera.bottom = -25;
      sun.shadow.camera.far = 70;
      sun.shadow.bias = -0.0005;
      sun.shadow.normalBias = 0.04;
      world.add(sun);

      const floorMat = new T.MeshStandardMaterial({ color: 0x050912, roughness: 0.86 });
      const floor = new T.Mesh(new T.PlaneGeometry(500, 500), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      world.add(floor);

      const gridHelper = new T.GridHelper(85, 55, 0x324052, 0x233044);
      gridHelper.position.y = 0.012;
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.35;
      world.add(gridHelper);

      const wallMat = new T.MeshStandardMaterial({ color: 0x162131, roughness: 0.8 });
      const trimMat = new T.MeshStandardMaterial({ color: 0x374153, roughness: 0.6 });

      function box(w: number, h: number, d: number, x: number, y: number, z: number, mat: any) {
        const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        m.castShadow = m.receiveShadow = true;
        world.add(m);
        return m;
      }

      const glowCanvas = document.createElement('canvas');
      glowCanvas.width = glowCanvas.height = 64;
      const ctx = glowCanvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,.8)');
        gradient.addColorStop(0.35, 'rgba(255,255,255,.3)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
      }
      const glowTex = new T.CanvasTexture(glowCanvas);

      const rooms: any[] = [];
      const spacing = 5.2;
      const rz = -7;
      const fz = -4.15;

      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * spacing;
        const mat = new T.MeshStandardMaterial({ color: 0x1a2433, emissive: palette[i], emissiveIntensity: 0.04, roughness: 0.8 });
        box(4.7, 0.12, 5.7, x, 0.07, rz, mat);
        box(4.7, 1.75, 0.16, x, 0.875, rz - 2.85, wallMat);
        box(0.16, 1.75, 5.7, x - 2.35, 0.875, rz, wallMat);
        box(0.16, 1.75, 5.7, x + 2.35, 0.875, rz, wallMat);

        box(1.65, 1.75, 0.16, x - 1.525, 0.875, fz, wallMat);
        box(1.65, 1.75, 0.16, x + 1.525, 0.875, fz, wallMat);
        box(0.08, 1.8, 0.2, x - 0.72, 0.9, fz, trimMat);
        box(0.08, 1.8, 0.2, x + 0.72, 0.9, fz, trimMat);

        const board = new T.MeshStandardMaterial({ color: 0x0a1220, emissive: palette[i], emissiveIntensity: 0.15 });
        box(2.8, 0.7, 0.06, x, 1.05, rz - 2.73, board);

        const desk = new T.MeshStandardMaterial({ color: 0x506071, roughness: 0.8 });
        for (let row = 0; row < 2; row++) {
          for (let col = 0; col < 3; col++) {
            box(0.8, 0.12, 0.48, x + (col - 1) * 1.2, 0.65, rz - 1.4 + row * 1.5, desk);
          }
        }

        const beamMat = new T.MeshBasicMaterial({ color: palette[i], map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
        const beam = new T.Mesh(new T.PlaneGeometry(3.5, 8), beamMat);
        beam.rotation.x = -Math.PI / 2;
        beam.position.set(x, 0.025, fz + 2);
        world.add(beam);

        const haloMat = beamMat.clone();
        const halo = new T.Sprite(haloMat);
        halo.position.set(x, 1, fz);
        halo.scale.set(3.5, 3.5, 1);
        world.add(halo);

        const light = new T.PointLight(palette[i], 0, 9, 2);
        light.position.set(x, 2, rz);
        world.add(light);

        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256;
        labelCanvas.height = 64;
        const labelCtx = labelCanvas.getContext('2d');
        if (labelCtx) {
          labelCtx.fillStyle = '#0a1220';
          labelCtx.fillRect(0, 0, 256, 64);
          labelCtx.strokeStyle = '#c9a96b';
          labelCtx.strokeRect(1, 1, 254, 62);
          labelCtx.fillStyle = '#f1ece1';
          labelCtx.font = '24px sans-serif';
          labelCtx.textAlign = 'center';
          labelCtx.fillText(['CSE-3', 'ECE-3', 'EE-3', 'ME-3', 'CE-3'][i], 128, 40);
        }
        const labelTex = new T.CanvasTexture(labelCanvas);
        const label = new T.Sprite(new T.SpriteMaterial({ map: labelTex, depthTest: false, transparent: true, opacity: 0.85 }));
        label.position.set(x, 2.6, rz - 2);
        label.scale.set(2.1, 0.525, 1);
        world.add(label);

        rooms.push({ x, mat, beamMat, haloMat, light, arrived: 0, total: 0 });
      }

      const bodyGeo = new T.SphereGeometry(1, 10, 8);
      bodyGeo.scale(0.19, 0.34, 0.14);
      bodyGeo.translate(0, 0.57, 0);

      const headGeo = new T.SphereGeometry(0.145, 10, 8);
      headGeo.translate(0, 1.02, 0);

      const hairGeo = new T.SphereGeometry(0.149, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56);
      hairGeo.translate(0, 1.05, 0);

      const packGeo = new T.SphereGeometry(1, 8, 6);
      packGeo.scale(0.16, 0.21, 0.11);
      packGeo.translate(0, 0.61, -0.17);

      const limbGeo = new T.CylinderGeometry(0.055, 0.045, 0.38, 6);
      limbGeo.translate(0, -0.15, 0);

      const bodies = new T.InstancedMesh(bodyGeo, new T.MeshStandardMaterial({ roughness: 0.85 }), maxN);
      const heads = new T.InstancedMesh(headGeo, new T.MeshStandardMaterial({ roughness: 0.8 }), maxN);
      const hair = new T.InstancedMesh(hairGeo, new T.MeshStandardMaterial({ color: 0x231e1c, roughness: 1 }), maxN);
      const packs = new T.InstancedMesh(packGeo, new T.MeshStandardMaterial({ roughness: 0.9 }), maxN);
      const legs = new T.InstancedMesh(limbGeo, new T.MeshStandardMaterial({ color: 0x182232, roughness: 1 }), maxN * 2);
      const arms = new T.InstancedMesh(limbGeo, new T.MeshStandardMaterial({ roughness: 0.8 }), maxN * 2);

      const meshes = [bodies, heads, hair, packs, legs, arms];
      for (const m of meshes) {
        m.castShadow = true;
        m.frustumCulled = false;
        m.instanceMatrix.setUsage(T.DynamicDrawUsage);
        world.add(m);
      }

      const skins = [0xe4b993, 0xc89570, 0xa56d4d, 0x754831, 0x523528];
      const agents: any[] = [];
      const color = new T.Color();

      for (let i = 0; i < maxN; i++) {
        const g = i % 5;
        const seat = Math.floor(i/5);
        rooms[g].total++;
        agents.push({
          x: 0,
          z: 0,
          angle: 0,
          yaw: 0,
          phase: i * 2.399,
          speed: 0.65 + (i % 7) * 0.09,
          height: 1.08 + (i % 9) * 0.035,
          g,
          state: 0,
          delay: 4.4 + (i % 11) * 0.075,
          seatX: rooms[g].x + ((seat % 5) - 2) * 0.72,
          seatZ: -5.1 - Math.floor(seat / 5) * 0.75,
          v: 0
        });

        color.setHex(palette[g]).multiplyScalar(0.75 + (i % 4) * 0.06);
        bodies.setColorAt(i, color);
        arms.setColorAt(i * 2, color);
        arms.setColorAt(i * 2 + 1, color);

        color.setHex(skins[i % 5]);
        heads.setColorAt(i, color);

        color.setHex(palette[(g + 2) % 5]).multiplyScalar(0.4);
        packs.setColorAt(i, color);
      }

      const dummy = new T.Object3D();
      const limb = new T.Object3D();
      const matrix = new T.Matrix4();
      dummy.rotation.order = 'YXZ';

      const cell = 1.15;
      const gw = 40;
      const gh = 32;
      const originX = -23;
      const originZ = -14;
      const gridHeads = new Int32Array(gw * gh);
      const next = new Int32Array(maxN);

      const dustCount = 100;
      const dustPos = new Float32Array(dustCount * 3);
      for (let i = 0; i < dustCount; i++) {
        dustPos[i * 3] = rooms[i % 5].x + Math.sin(i * 17) * 0.7;
        dustPos[i * 3 + 1] = 0.3 + (i % 19) * 0.11;
        dustPos[i * 3 + 2] = fz + (i % 13) * 0.3;
      }
      const dustGeo = new T.BufferGeometry();
      dustGeo.setAttribute('position', new T.BufferAttribute(dustPos, 3));
      const dust = new T.Points(dustGeo, new T.PointsMaterial({
        color: 0xc9a96b,
        size: 0.045,
        map: glowTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: T.AdditiveBlending
      }));
      world.add(dust);

      const ring = new T.Mesh(new T.RingGeometry(0.9, 1, 64), new T.MeshBasicMaterial({
        color: 0xc9a96b,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending
      }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.04, 2);
      world.add(ring);

      let curve: any = null;
      let lookCurve: any = null;
      let baseFov = 42;
      const pos = new T.Vector3();
      const look = new T.Vector3();

      function resize() {
        const aspect = window.innerWidth / window.innerHeight;
        cam.aspect = aspect;
        baseFov = aspect < 0.8 ? 48 : 42;
        renderer.setSize(window.innerWidth, window.innerHeight);
        const fit = Math.max(25, 32 / (2 * Math.tan(baseFov * Math.PI / 360) * aspect));
        const portrait = aspect < 0.8;
        world.fog.near = portrait ? fit * 0.85 : 40;
        world.fog.far = portrait ? fit * 2 : 100;
        const height = portrait ? fit * 0.66 : 22;
        const depth = portrait ? fit * 0.74 : 24;

        curve = new T.CatmullRomCurve3([
          new T.Vector3(0, height, depth),
          new T.Vector3(-5, portrait ? 23 : 12, portrait ? 22 : 12),
          new T.Vector3(4, portrait ? 23 : 10, portrait ? 22 : 10),
          new T.Vector3(0, portrait ? 31 : 27, portrait ? 26 : 16),
          new T.Vector3(11, portrait ? 23 : 11, portrait ? 22 : 13),
          new T.Vector3(0, height, depth)
        ], false, 'catmullrom', 0.25);

        lookCurve = new T.CatmullRomCurve3([
          new T.Vector3(0, portrait ? 18 : 10, -1),
          new T.Vector3(portrait ? -9 : -13, 0, -6),
          new T.Vector3(portrait ? 0 : -3, 0, -6),
          new T.Vector3(0, 0, -5),
          new T.Vector3(portrait ? 5 : 2, 0, -6),
          new T.Vector3(0, 0, -2)
        ], false, 'catmullrom', 0.2);

        cam.fov = baseFov;
        cam.updateProjectionMatrix();
        apiScene.dirty = true;
      }

      function reset() {
        final = false;
        for (let r = 0; r < 5; r++) rooms[r].arrived = 0;
        for (let i = 0; i < maxN; i++) {
          const a = agents[i];
          a.x = Math.sin(i * 27.14) * 13;
          a.z = -1 + (i % 17) * 0.5;
          a.angle = i * 2.399;
          a.yaw = a.angle;
          a.state = 0;
          a.v = 0;
        }
        apiScene.dirty = true;
      }

      function finish() {
        final = true;
        for (let i = 0; i < count; i++) {
          const a = agents[i];
          a.x = a.seatX;
          a.z = a.seatZ;
          a.state = 3;
          a.yaw = Math.PI;
          a.v = 0;
        }
        for (let i = 0; i < 5; i++) rooms[i].arrived = rooms[i].total;
        apiScene.dirty = true;
      }

      function degrade(level: number) {
        count = Math.floor(maxN * (level === 1 ? 0.72 : 0.5) / 5) * 5;
        for (let i = 0; i < 5; i++) {
          rooms[i].total = count / 5;
          rooms[i].arrived = 0;
        }
        for (let i = 0; i < count; i++) {
          if (agents[i].state === 3) rooms[agents[i].g].arrived++;
        }
        bodies.count = heads.count = hair.count = packs.count = count;
        legs.count = arms.count = count * 2;
        renderer.shadowMap.enabled = false;
        sun.castShadow = false;
        world.traverse((o: any) => {
          if (o.isMesh) {
            o.castShadow = false;
            o.receiveShadow = false;
            if (o.material) o.material.needsUpdate = true;
          }
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, level === 1 ? 1.25 : 1));
        renderer.setSize(window.innerWidth, window.innerHeight);
        dust.visible = level < 2;
        apiScene.dirty = true;
      }

      function update(dt: number, t: number, p: number, reduce: boolean) {
        time += dt;
        gridHeads.fill(-1);

        for (let i = 0; i < count; i++) {
          const a = agents[i];
          if (a.state === 3) continue;
          const cx = clamp(Math.floor((a.x - originX) / cell), 0, gw - 1);
          const cz = clamp(Math.floor((a.z - originZ) / cell), 0, gh - 1);
          const idx = cz * gw + cx;
          next[i] = gridHeads[idx];
          gridHeads[idx] = i;
        }

        for (let i = 0; i < count; i++) {
          const a = agents[i];
          let vx = 0;
          let vz = 0;
          let sx = 0;
          let sz = 0;

          if (a.state !== 3 && !final) {
            const cx = clamp(Math.floor((a.x - originX) / cell), 0, gw - 1);
            const cz = clamp(Math.floor((a.z - originZ) / cell), 0, gh - 1);
            for (let z = Math.max(0, cz - 1); z <= Math.min(gh - 1, cz + 1); z++) {
              for (let x = Math.max(0, cx - 1); x <= Math.min(gw - 1, cx + 1); x++) {
                let j = gridHeads[z * gw + x];
                while (j !== -1) {
                  if (j !== i) {
                    const b = agents[j];
                    const dx = a.x - b.x;
                    const dz = a.z - b.z;
                    const d2 = dx * dx + dz * dz;
                    if (d2 > 0.0001 && d2 < 0.49) {
                      const force = (0.7 - Math.sqrt(d2)) / 0.7;
                      sx += dx * force / (d2 + 0.1);
                      sz += dz * force / (d2 + 0.1);
                    }
                  }
                  j = next[j];
                }
              }
            }

            if (t < 3.8) {
              const pause = Math.sin(t * 0.9 + a.phase) > 0.7;
              a.angle += Math.sin(t * 0.6 + a.phase) * dt * 0.65;
              if (Math.abs(a.x) > 13.5 || a.z < -0.8 || a.z > 7.5) a.angle = Math.atan2(-a.x, 3 - a.z);
              if (!pause) {
                vx = Math.sin(a.angle) * a.speed + sx * 0.6;
                vz = Math.cos(a.angle) * a.speed + sz * 0.6;
              } else {
                a.yaw += Math.sin(t * 2 + a.phase) * dt * 0.7;
              }
            } else if (t > a.delay) {
              if (a.state === 0) a.state = 1;
              const tx = a.state === 1 ? rooms[a.g].x : a.state === 2 ? rooms[a.g].x : a.seatX;
              const tz = a.state === 1 ? fz + 0.8 : a.state === 2 ? fz - 0.65 : a.seatZ;
              let targetX = tx;
              let targetZ = tz;
              if (a.state === 4) {
                targetX = a.seatX;
                targetZ = a.seatZ;
              }
              const dx = targetX - a.x;
              const dz = targetZ - a.z;
              const d = Math.sqrt(dx * dx + dz * dz);
              const goal = (a.state === 4 ? 3.2 : 5.2) * ease((t - a.delay) / 0.9);
              a.v += (goal - a.v) * Math.min(1, dt * 5);
              if (d < 0.12) {
                if (a.state === 1) a.state = 2;
                else if (a.state === 2) a.state = 4;
                else {
                  a.state = 3;
                  rooms[a.g].arrived++;
                }
              } else {
                const speed = Math.min(a.v, d / Math.max(dt, 0.001));
                vx = dx / d * speed;
                vz = dz / d * speed;
                if (a.state === 1 && d > 1.7) {
                  vx += sx * 0.45;
                  vz += sz * 0.45;
                }
              }
            }
            a.x += vx * dt;
            a.z += vz * dt;
          }

          const moving = Math.abs(vx) + Math.abs(vz) > 0.06;
          const speed = Math.sqrt(vx * vx + vz * vz);
          const walk = Math.sin(time * (moving ? 10 + speed : 1) + a.phase);
          const yaw = moving ? Math.atan2(vx, vz) : a.state === 3 ? Math.PI : a.yaw;
          a.yaw += Math.atan2(Math.sin(yaw - a.yaw), Math.cos(yaw - a.yaw)) * Math.min(1, dt * 10);

          dummy.position.set(a.x, moving ? Math.abs(walk) * 0.045 : 0, a.z);
          dummy.rotation.set(moving ? Math.min(0.16, speed * 0.025) : 0, a.yaw, moving ? walk * 0.025 : 0);
          dummy.scale.setScalar(a.height);
          dummy.updateMatrix();
          bodies.setMatrixAt(i, dummy.matrix);
          heads.setMatrixAt(i, dummy.matrix);
          hair.setMatrixAt(i, dummy.matrix);
          packs.setMatrixAt(i, dummy.matrix);

          for (let side = 0; side < 2; side++) {
            const sign = side === 0 ? -1 : 1;
            limb.position.set(sign * 0.09, 0.31, 0);
            limb.rotation.set(moving ? walk * sign * 0.52 : 0, 0, 0);
            limb.updateMatrix();
            matrix.multiplyMatrices(dummy.matrix, limb.matrix);
            legs.setMatrixAt(i * 2 + side, matrix);

            limb.position.set(sign * 0.235, 0.76, 0);
            limb.rotation.set(moving ? -walk * sign * 0.45 : 0, 0, -sign * 0.1);
            limb.updateMatrix();
            matrix.multiplyMatrices(dummy.matrix, limb.matrix);
            arms.setMatrixAt(i * 2 + side, matrix);
          }
        }

        for (let i = 0; i < meshes.length; i++) meshes[i].instanceMatrix.needsUpdate = true;

        const bell = t - 3.8;
        const shock = bell >= 0 && bell < 1.7 && !final ? 1 - bell / 1.7 : 0;
        ring.material.opacity = shock * 0.65;
        ring.scale.setScalar(1 + (1 - shock) * 28);
        if (flashEl) flashEl.style.opacity = shock > 0.7 ? String((shock - 0.7) * 0.5) : '0';

        const highlight = Math.min(4, Math.floor(p * 5));
        for (let i = 0; i < 5; i++) {
          const room = rooms[i];
          const fill = room.arrived / Math.max(1, room.total);
          const target = fill * (highlight === i ? 0.5 : 0.24);
          room.mat.emissiveIntensity = reduce ? target : room.mat.emissiveIntensity + (target - room.mat.emissiveIntensity) * Math.min(1, dt * 3);
          room.light.intensity = fill * (highlight === i ? 1.4 : 0.65);
          room.beamMat.opacity = t >= 3.8 ? 0.3 + fill * 0.15 : 0;
          room.haloMat.opacity = t >= 3.8 ? 0.13 + fill * 0.12 : 0;
        }
        dust.material.opacity = t >= 3.8 ? 0.36 : 0;
        if (!reduce) dust.rotation.y = Math.sin(time * 0.17) * 0.008;

        if (curve && lookCurve) {
          curve.getPoint(p, pos);
          lookCurve.getPoint(p, look);
          if (!reduce) {
            pos.x += Math.sin(time * 0.43) * 0.07;
            pos.y += Math.sin(time * 0.57) * 0.05;
          }
          cam.position.copy(pos);
          cam.lookAt(look);
        }

        const fov = baseFov + (shock > 0 ? Math.sin(clamp(bell / 0.5) * Math.PI) * 2.3 : 0);
        if (Math.abs(cam.fov - fov) > 0.005) {
          cam.fov = fov;
          cam.updateProjectionMatrix();
        }
        renderer.render(world, cam);
      }

      function dispose() {
        world.traverse((o: any) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) {
              for (const m of o.material) m.dispose();
            } else {
              if (o.material.map && o.material.map !== glowTex) o.material.map.dispose();
              o.material.dispose();
            }
          }
        });
        glowTex.dispose();
        renderer.dispose();
      }

      const apiScene = { update, resize, reset, finish, degrade, dispose, dirty: true };
      resize();
      reset();
      return apiScene;
    }

    async function boot() {
      if (loader) loader.hidden = false;
      if (controls) controls.hidden = reduced;
      setLoad(5);

      try {
        await Promise.all([
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js').then(() => setLoad(50)),
          loadScript('https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.min.js')
        ]);
        if (unmounted) return;
        setLoad(75);
        if (!(window as any).THREE || !(window as any).Lenis) throw new Error('Dependency unavailable');

        scene = createScene();
        root.classList.add('webgl');
        setLoad(100);
        if (loader) loader.hidden = true;

        const LenisClass = (window as any).Lenis;
        if (!reduced && LenisClass) {
          lenis = new LenisClass({ autoRaf: false, duration: 1.1, smoothWheel: true, syncTouch: false });
        }

        if (reduced || skipped || window.scrollY > window.innerHeight * 0.3) {
          finishIntro(false);
        } else {
          running = true;
          root.classList.add('intro-running');
        }

        if (reBtn) reBtn.disabled = reduced;
        viewportDirty = true;
      } catch (err) {
        fallback();
      }
    }

    if (reduced) {
      if (reBtn) reBtn.disabled = true;
      for (const h of headings) h.classList.add('seen');
    }

    raf = requestAnimationFrame(frame);
    boot();

    // Comprehensive unmount cleanup
    return () => {
      unmounted = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      mq.removeEventListener('change', onMqChange);

      for (const item of anchorHandlers) {
        item.anchor.removeEventListener('click', item.handler);
      }
      for (const cleanup of btnMoveCleanups) {
        cleanup();
      }

      observer?.disconnect();
      lenis?.destroy();
      lenis = null;

      try {
        audio?.close();
      } catch {}

      if (scene) {
        scene.dispose();
        scene = null;
      }
      const canvas = stagePin?.querySelector('canvas');
      if (canvas) canvas.remove();

      root.classList.remove('webgl', 'intro-running', 'title-on', 'ringing', 'motion-ready');
      document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped');
      document.body.classList.remove('lenis', 'lenis-smooth', 'lenis-stopped');
    };
  }, []);

  return (
    <div className="cit-landing" ref={containerRef}>
      <a className="skip-link" href="#roles">Skip to roles</a>

      {/* Main Navigation */}
      <nav id="nav" aria-label="Main navigation">
        <a className="brand" href="#hero" aria-label="CIT Schedule Home">
          <span id="mark" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          CIT Schedule
        </a>

        {/* Desktop Navigation Links */}
        <div className="nl hidden md:flex items-center gap-6">
          <a href="#timetable" data-nav>Timetable</a>
          <a href="#roles" data-nav>Roles</a>
          <a href="#how" data-nav>How it works</a>
          <button className="btn" type="button" onClick={() => setModalOpen(true)}>
            Sign in
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn text-xs px-3 py-1.5"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-expanded={mobileNavOpen}
            aria-controls="landing-mobile-menu"
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            className="w-11 h-11 flex items-center justify-center rounded-sm bg-[#0a1220] border border-[#f1ece125] text-[#f1ece1] hover:text-[#c9a96b] cursor-pointer"
          >
            {mobileNavOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileNavOpen && (
          <div
            id="landing-mobile-menu"
            role="menu"
            aria-label="Mobile Navigation Menu"
            className="md:hidden absolute top-full left-0 right-0 bg-[#0a1220]/95 backdrop-blur-xl border-b border-[#f1ece120] p-4 flex flex-col gap-2 z-50 shadow-2xl animate-in fade-in"
          >
            <a
              href="#timetable"
              onClick={() => setMobileNavOpen(false)}
              className="min-h-[44px] flex items-center px-3 text-sm text-[#f1ece1] hover:text-[#c9a96b] border-b border-[#f1ece110]"
            >
              01 — Timetable
            </a>
            <a
              href="#booking"
              onClick={() => setMobileNavOpen(false)}
              className="min-h-[44px] flex items-center px-3 text-sm text-[#f1ece1] hover:text-[#c9a96b] border-b border-[#f1ece110]"
            >
              02 — Venue Booking
            </a>
            <a
              href="#roles"
              onClick={() => setMobileNavOpen(false)}
              className="min-h-[44px] flex items-center px-3 text-sm text-[#f1ece1] hover:text-[#c9a96b] border-b border-[#f1ece110]"
            >
              03 — Roles & Permissions
            </a>
            <a
              href="#how"
              onClick={() => setMobileNavOpen(false)}
              className="min-h-[44px] flex items-center px-3 text-sm text-[#f1ece1] hover:text-[#c9a96b] border-b border-[#f1ece110]"
            >
              04 — How It Works
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                setModalOpen(true);
              }}
              className="min-h-[44px] w-full mt-2 py-2.5 bg-[#c9a96b] hover:bg-[#d8be85] text-[#0a1220] font-semibold text-sm rounded-sm flex items-center justify-center cursor-pointer transition-colors"
            >
              Sign In to Platform →
            </button>
          </div>
        )}
        <div id="progress" aria-hidden="true"></div>
      </nav>

      {/* Film Grain Texture */}
      <div className="grain" aria-hidden="true"></div>

      {/* Campus Preparation Loader */}
      <div id="loader" role="status" hidden>
        <div>
          <span>Preparing campus</span>
          <span id="load-value">0%</span>
        </div>
        <progress id="load-progress" max="100" value="0" aria-label="Loading campus"></progress>
      </div>

      {/* Audio & Skip Controls */}
      <div id="controls" hidden>
        <button id="sound" type="button" aria-pressed="false">Sound off</button>
        <button id="skip" type="button">Skip intro</button>
      </div>

      <main id="main">
        <div id="story">
          {/* 3D WebGL Campus Stage */}
          <div id="stage" aria-hidden="true">
            <div id="stage-pin">
              <div className="blueprint">
                <i></i><i></i><i></i><i></i><i></i>
              </div>
              <div className="vignette"></div>
              <div id="flash"></div>
            </div>
          </div>

          {/* Hero Section */}
          <header id="hero">
            <div id="cap">
              <svg id="bell" aria-hidden="true" viewBox="0 0 24 24">
                <path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4zM10 20h4M12 2v2" />
              </svg>
              <span id="cap-text">Monday, 8:55 am. 1,000 students, 27 rooms, one timetable.</span>
            </div>

            <h1 id="title" aria-label="CIT Schedule">CIT Schedule</h1>

            <div id="bar" aria-hidden="true">
              <i></i><i></i><i></i><i></i><i></i>
            </div>

            <p id="tag">Every student gets a class, a room and a time, with no clashes.</p>

            {/* Interactive Role Links */}
            <div id="rl">
              <span>Sign in as</span>
              <button
                type="button"
                className="role-pill"
                aria-label="Sign in as Admin"
                onClick={() => handleRoleLogin('admin')}
              >
                Admin
              </button>
              <button
                type="button"
                className="role-pill"
                aria-label="Sign in as Department coordinator"
                onClick={() => handleRoleLogin('coordinator')}
              >
                Department coordinator
              </button>
              <button
                type="button"
                className="role-pill"
                aria-label="Sign in as Faculty"
                onClick={() => handleRoleLogin('faculty')}
              >
                Faculty
              </button>
              <button
                type="button"
                className="role-pill"
                aria-label="Sign in as Club representative"
                onClick={() => handleRoleLogin('club')}
              >
                Club representative
              </button>
            </div>

            <a id="hint" href="#timetable">Scroll</a>
            <span className="hero-index" aria-hidden="true">CIT / 01—05</span>
          </header>

          {/* 01: Timetable */}
          <section className="story-step" id="timetable">
            <article className="card" data-index="01 / 04" data-c=".27" data-r="0">
              <span className="k" style={{ color: 'var(--gold)' }}>Timetable</span>
              <h2>One timetable. Zero clashes.</h2>
              <p>A solver places all {stats?.sessions_scheduled ?? 189} sessions across 27 rooms. A separate validator then checks every group, teacher and room, so nothing is in two places at once.</p>
              <div className="nums">
                <div>
                  <b>{stats?.sessions_scheduled ?? 189}</b>
                  <span>sessions</span>
                </div>
                <div>
                  <b>{stats?.hard_violations ?? 0}</b>
                  <span>hard clashes</span>
                </div>
              </div>
            </article>
            <span className="scene-caption" aria-hidden="true">01 — Timetable</span>
          </section>

          {/* 02: Venue booking */}
          <section className="story-step" id="booking">
            <article className="card" data-index="02 / 04" data-c=".45" data-r="2">
              <span className="k" style={{ color: 'var(--gold)' }}>Venue booking</span>
              <h2>Ask for a room in your own words.</h2>
              <p>Type it in English or Hinglish. You check the booking before it is submitted.</p>
              <div className="mock" id="ty" aria-label="seminar hall kal shaam 6 baje, 2 ghante, 100 log, mic chahiye">
                <span aria-hidden="true">seminar hall kal shaam 6 baje, 2 ghante, 100 log, mic chahiye</span>
              </div>
              <div className="chips" id="ch">
                <b>Seminar hall</b>
                <b>Tomorrow, 6 pm</b>
                <b>2 hours</b>
                <b>100 people</b>
                <b>Mic</b>
              </div>
            </article>
            <span className="scene-caption" aria-hidden="true">02 — Venue booking</span>
          </section>

          {/* 03: Spectra week */}
          <section className="story-step" id="spectra">
            <article className="card" data-index="03 / 04" data-c=".63" data-r="9">
              <span className="k" style={{ color: 'var(--gold)' }}>Spectra week</span>
              <h2>Every request gets a decision and a reason.</h2>
              <p>Exams first, then classes, then institute events. A rejected booking says why, and offers another slot when one exists.</p>
            </article>
            <span className="scene-caption" aria-hidden="true">03 — Spectra week</span>
          </section>

          {/* 04: Last-minute changes */}
          <section className="story-step" id="changes">
            <article className="card" data-index="04 / 04" data-c=".8" data-r="3">
              <span className="k" style={{ color: 'var(--gold)' }}>Last-minute changes</span>
              <h2>A teacher is away. Almost nothing moves.</h2>
              <p>The platform proposes the smallest fix, shows exactly what changed, and applies it only after an admin approves.</p>
              <div className="nums">
                <div>
                  <b>{stats?.last_reschedule_moved_count ?? 14}</b>
                  <span>sessions moved</span>
                </div>
                <div>
                  <b>{stats?.hard_violations ?? 0}</b>
                  <span>new clashes</span>
                </div>
              </div>
            </article>
            <span className="scene-caption" aria-hidden="true">04 — Last-minute changes</span>
          </section>

          {/* 05: Open the platform */}
          <section className="story-step end-step" id="open">
            <article className="card end" data-index="05 / 04" data-c=".95" data-r="9">
              <h2>See your week, clash-free.</h2>
              <p>Sign in as an admin, coordinator, faculty member or club representative.</p>
              <button className="btn" type="button" onClick={() => setModalOpen(true)}>
                Open the platform
              </button>
              <button className="btn g" id="re" type="button">
                Replay intro
              </button>
            </article>
          </section>
        </div>

        {/* After Story Details */}
        <div id="after">
          <section className="blk">
            <h2>Week 7 is where timetables break.</h2>
            <p className="lead">
              Classes are still running, midsems start the week after, and Spectra needs the auditorium, the seminar halls and the labs. CIT Schedule gives every request one place to go and one set of rules to pass.
            </p>
          </section>

          {/* Roles Grid */}
          <section className="blk" id="roles">
            <h2>Four roles. 62 accounts. One set of rules.</h2>
            <p className="lead">Rule-based authentication derived directly from the official CIT dataset. Every faculty member, department head and student club has an active institutional profile.</p>
            <div className="grid">
              <div style={{ boxShadow: 'inset 0 2px #6f8fb8' }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="m-0">Admin</h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#6f8fb8]/20 text-[#6f8fb8]">2 Accounts</span>
                </div>
                <p>Dean’s Office and Spectra Core. Generates timetable, approves disruptions and manages global priorities.</p>
                <button
                  type="button"
                  className="role-link"
                  onClick={() => openRoleModal('admin')}
                >
                  Browse & Sign in as Admin →
                </button>
              </div>

              <div style={{ boxShadow: 'inset 0 2px #5fa8a0' }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="m-0">Department coordinator</h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#5fa8a0]/20 text-[#5fa8a0]">9 Departments</span>
                </div>
                <p>CSE, ECE, EE, ME, CE, HSS, MA, PH, and T&P Cell. Requests department session moves and manages lab bookings.</p>
                <button
                  type="button"
                  className="role-link"
                  onClick={() => openRoleModal('coordinator')}
                >
                  Browse 9 Coordinators →
                </button>
              </div>

              <div style={{ boxShadow: 'inset 0 2px #c9a96b' }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="m-0">Faculty</h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#c9a96b]/20 text-[#c9a96b]">40 Faculty</span>
                </div>
                <p>40 professors and lecturers (F01–F40). Views teaching schedules, marks leave/unavailability, and requests class reschedules.</p>
                <button
                  type="button"
                  className="role-link"
                  onClick={() => openRoleModal('faculty')}
                >
                  Browse 40 Faculty Members →
                </button>
              </div>

              <div style={{ boxShadow: 'inset 0 2px #c27d5e' }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="m-0">Club representative</h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#c27d5e]/20 text-[#c27d5e]">11 Societies</span>
                </div>
                <p>11 student cultural and technical societies. Submits and manages Spectra week venue requests with transparent reasons.</p>
                <button
                  type="button"
                  className="role-link"
                  onClick={() => openRoleModal('club')}
                >
                  Browse 11 Club Accounts →
                </button>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="blk" id="how">
            <h2>How a week gets planned.</h2>
            <div className="grid">
              <div>
                <span className="n">1</span>
                <h3>Load the data</h3>
                <p>An admin loads the dataset: rooms, faculty, student groups, courses and sessions.</p>
              </div>
              <div>
                <span className="n">2</span>
                <h3>Generate and check</h3>
                <p>A solver gives every session a day, a period and a room. An independent validator checks every hard rule.</p>
              </div>
              <div>
                <span className="n">3</span>
                <h3>Book, change, approve</h3>
                <p>Venue requests, Spectra week decisions and last-minute changes all pass the same checks. An admin approves before anything is applied.</p>
              </div>
            </div>
          </section>

          {/* Verification & Transparency */}
          <section className="blk">
            <h2>Built to be checked.</h2>
            <div className="grid">
              <div>
                <h3>Code decides</h3>
                <p>AI reads requests and explains decisions. Only our rules code decides whether a schedule or a booking is valid.</p>
              </div>
              <div>
                <h3>Every decision explained</h3>
                <p>Ask why a class sits at 8 am or why a booking was rejected, and get the actual reasons.</p>
              </div>
              <div>
                <h3>Nothing hidden</h3>
                <p>Export the timetable, exams and booking decisions as schedule.json whenever you need them.</p>
              </div>
            </div>
          </section>

          {/* Dataset Stats */}
          <section className="blk" id="dataset">
            <h2>The CIT dataset.</h2>
            <div className="grid big">
              <div>
                <b>14</b>
                <span>student groups</span>
              </div>
              <div>
                <b>40</b>
                <span>faculty</span>
              </div>
              <div>
                <b>27</b>
                <span>rooms</span>
              </div>
              <div>
                <b>62</b>
                <span>courses</span>
              </div>
              <div>
                <b>{stats?.sessions_scheduled ?? 189}</b>
                <span>sessions a week</span>
              </div>
              <div>
                <b>41</b>
                <span>midsem exams</span>
              </div>
            </div>
          </section>

          {/* Footer */}
          {/* Accessible Institutional Footer */}
          <footer>
            <div>
              <b>CIT Schedule</b>
              Timetable and venue management for Chilika Institute of Technology.
              <div className="mt-3 flex flex-wrap gap-4 text-xs font-mono">
                <a href="tel:+916756200100" className="text-[#c9a96b] hover:underline flex items-center gap-1" aria-label="Call CIT Scheduling Helpdesk">
                  📞 +91 (6756) 200-100
                </a>
                <a href="mailto:scheduling@cit.edu" className="text-[#c9a96b] hover:underline flex items-center gap-1" aria-label="Email CIT Scheduling Helpdesk">
                  ✉️ scheduling@cit.edu
                </a>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex flex-wrap gap-3 text-xs text-[#acb5c3]">
                <a href="#timetable" className="hover:text-white">Timetable</a>
                <a href="#booking" className="hover:text-white">Venue Booking</a>
                <a href="#roles" className="hover:text-white">Roles</a>
                <a href="#how" className="hover:text-white">How It Works</a>
              </div>
              <button
                type="button"
                className="footer-signin min-h-[44px] px-4 py-2 cursor-pointer"
                onClick={() => setModalOpen(true)}
              >
                Sign in
              </button>
            </div>

            <p>
              &copy; {new Date().getFullYear()} Chilika Institute of Technology. Built for the CIT campus scheduling platform. AI use declared in AI_USAGE.md. All institutional rights reserved.
            </p>
          </footer>
        </div>
      </main>

      {/* Role Sign-in / Custom Credentials Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#030712]/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => !isLoggingIn && setModalOpen(false)}
        >
          <div
            className="bg-[#090f1d] border border-slate-700/70 rounded-xl shadow-2xl w-full max-w-6xl h-[92vh] max-h-[860px] flex flex-col overflow-hidden relative text-[#f1ece1]"
            onClick={e => e.stopPropagation()}
          >
            {/* Top Header Bar */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-800/80 bg-[#0c1424] flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-[#c9a96b]/20 border border-[#c9a96b]/40 flex items-center justify-center text-[#c9a96b] font-serif font-bold text-sm flex-shrink-0">
                  CIT
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-serif text-[#f1ece1] font-medium truncate">
                      Institutional Role Access & Sign In
                    </h2>
                    <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#c9a96b]/15 text-[#c9a96b] border border-[#c9a96b]/30 flex-shrink-0">
                      Official CIT Dataset · 62 Accounts
                    </span>
                  </div>
                  <p className="text-[11px] text-[#acb5c3] truncate hidden sm:block">
                    Enter email or ID and password, or browse all 62 campus members with 1-click access.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="text-[#acb5c3] hover:text-[#f1ece1] text-lg font-mono p-1.5 rounded hover:bg-slate-800 transition-colors ml-3 cursor-pointer"
                onClick={() => !isLoggingIn && setModalOpen(false)}
                disabled={isLoggingIn}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Mobile Tab Switcher (< lg only) */}
            <div className="flex lg:hidden border-b border-slate-800 bg-[#070c17] flex-shrink-0">
              <button
                type="button"
                onClick={() => setMobileView('form')}
                className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-all flex items-center justify-center gap-2 ${
                  mobileView === 'form'
                    ? 'border-[#c9a96b] text-[#c9a96b] font-semibold bg-[#0d1627]'
                    : 'border-transparent text-[#acb5c3] hover:text-white'
                }`}
              >
                <span>🔑</span>
                <span>Sign In Form</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileView('directory')}
                className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-all flex items-center justify-center gap-2 ${
                  mobileView === 'directory'
                    ? 'border-[#c9a96b] text-[#c9a96b] font-semibold bg-[#0d1627]'
                    : 'border-transparent text-[#acb5c3] hover:text-white'
                }`}
              >
                <span>👥</span>
                <span>Campus Directory (62)</span>
              </button>
            </div>

            {/* Main Dual-Panel Content */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80 overflow-hidden">
              
              {/* Left Panel: Dedicated Credential Form */}
              <div className={`w-full lg:w-[420px] xl:w-[450px] flex-shrink-0 flex flex-col overflow-y-auto p-5 sm:p-6 bg-[#0a1120] ${
                mobileView === 'form' ? 'flex' : 'hidden lg:flex'
              }`}>
                {/* Form Header */}
                <div className="mb-4">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-[#c9a96b] font-semibold block mb-1">
                    Direct Authentication
                  </span>
                  <h3 className="text-xl font-serif text-[#f1ece1] font-normal">
                    Enter Credentials
                  </h3>
                  <p className="text-xs text-[#acb5c3] mt-1 leading-relaxed">
                    Log in with your official CIT email or institutional ID (Faculty ID, Dept code, Club name, Admin) and password.
                  </p>
                </div>

                {/* Error Banner */}
                {loginError && (
                  <div className="mb-4 p-3 bg-red-950/70 border border-red-500/50 rounded-sm text-red-200 text-xs flex items-start justify-between gap-2 animate-in fade-in">
                    <div className="flex items-start gap-1.5">
                      <span className="text-red-400 font-bold">⚠️</span>
                      <span>{loginError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLoginError(null)}
                      className="text-red-400 hover:text-white text-xs underline flex-shrink-0 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Form Inputs */}
                <form
                  onSubmit={handleManualLogin}
                  className={`space-y-4 transition-all duration-300 ${
                    isFormHighlighted ? 'ring-2 ring-[#c9a96b] p-2 rounded-md bg-[#0e172a]' : ''
                  }`}
                >
                  {/* Campus Identifier */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] uppercase tracking-wider text-[#acb5c3] font-semibold">
                        Campus ID or Official Email
                      </label>
                      {manualIdentifier && (
                        <button
                          type="button"
                          onClick={() => setManualIdentifier('')}
                          className="text-[10px] text-[#acb5c3] hover:text-[#f1ece1] underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={manualIdentifier}
                      onChange={e => setManualIdentifier(e.target.value)}
                      placeholder="e.g. F06, CSE, dance, admin, or full email"
                      disabled={isLoggingIn}
                      className="w-full px-3.5 py-2.5 bg-[#050912] border border-slate-700 focus:border-[#c9a96b] rounded-sm text-sm text-[#f1ece1] placeholder-[#acb5c3]/40 focus:outline-none transition-all"
                    />
                    {/* Live Detection Badge */}
                    {detectedAccount ? (
                      <div className="mt-1.5 p-2 rounded-sm bg-[#c9a96b]/15 border border-[#c9a96b]/35 flex items-center justify-between text-xs animate-in fade-in">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[#c9a96b] font-bold text-[11px]">✓</span>
                          <span className="text-white font-medium truncate">{detectedAccount.name}</span>
                          <span className="text-[10px] font-mono px-1 rounded bg-[#0a1120] text-[#c9a96b]">
                            {detectedAccount.faculty_id || detectedAccount.department || detectedAccount.role}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setManualPassword(detectedAccount.rule_password)}
                          className="text-[10px] font-mono text-[#c9a96b] hover:text-white underline ml-2 whitespace-nowrap cursor-pointer"
                        >
                          Use Pwd
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-[#acb5c3]/65 block mt-1">
                        Accepts Faculty ID (F01–F40), Dept Code (CSE, ECE, ME, CE...), Club (dance, coding...), Admin, or full email.
                      </span>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#acb5c3] mb-1.5 font-semibold">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={manualPassword}
                        onChange={e => setManualPassword(e.target.value)}
                        placeholder="Enter rule password (e.g. F06@123, Faculty@123)"
                        disabled={isLoggingIn}
                        className="w-full px-3.5 py-2.5 bg-[#050912] border border-slate-700 focus:border-[#c9a96b] rounded-sm text-sm text-[#f1ece1] placeholder-[#acb5c3]/40 focus:outline-none transition-all pr-16 font-mono"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#acb5c3] hover:text-[#f1ece1] font-mono px-2 py-1 rounded bg-slate-800/80 cursor-pointer"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <span className="text-[10px] text-[#acb5c3]/65 block mt-1">
                      Accepts member rule password (<span className="text-slate-300">F06@123</span>, <span className="text-slate-300">Coord@CSE123</span>) or role universal password (<span className="text-slate-300">Faculty@123</span>).
                    </span>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-3 bg-[#c9a96b] hover:bg-[#d8be85] text-[#0a1220] font-semibold text-sm rounded-sm transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 mt-1"
                  >
                    {isLoggingIn ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#0a1220] border-t-transparent rounded-full animate-spin"></div>
                        <span>Signing in to platform...</span>
                      </>
                    ) : (
                      <span>Sign In to Platform →</span>
                    )}
                  </button>
                </form>

                {/* Quick-Fill Sample Accounts */}
                <div className="mt-5 pt-4 border-t border-slate-800/80">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-[#acb5c3] block mb-2 font-semibold">
                    1-Tap Test Accounts (Fills Form):
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => fillFormCredentials('F06', 'F06@123')}
                      className="text-left p-2 rounded-sm bg-[#050912] hover:bg-slate-800/80 border border-slate-800 hover:border-[#c9a96b]/40 text-xs transition-colors cursor-pointer group"
                    >
                      <span className="text-[#c9a96b] font-medium block truncate group-hover:text-white">Dr. Arjun Mehta</span>
                      <span className="text-[10px] text-[#acb5c3] font-mono block">F06 · F06@123</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fillFormCredentials('CSE', 'Coord@CSE123')}
                      className="text-left p-2 rounded-sm bg-[#050912] hover:bg-slate-800/80 border border-slate-800 hover:border-[#5fa8a0]/40 text-xs transition-colors cursor-pointer group"
                    >
                      <span className="text-[#5fa8a0] font-medium block truncate group-hover:text-white">CSE Coordinator</span>
                      <span className="text-[10px] text-[#acb5c3] font-mono block">CSE · Coord@CSE123</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fillFormCredentials('dance', 'Club@Dance123')}
                      className="text-left p-2 rounded-sm bg-[#050912] hover:bg-slate-800/80 border border-slate-800 hover:border-[#c27d5e]/40 text-xs transition-colors cursor-pointer group"
                    >
                      <span className="text-[#c27d5e] font-medium block truncate group-hover:text-white">Dance Club</span>
                      <span className="text-[10px] text-[#acb5c3] font-mono block">dance · Club@Dance123</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fillFormCredentials('admin', 'Admin@123')}
                      className="text-left p-2 rounded-sm bg-[#050912] hover:bg-slate-800/80 border border-slate-800 hover:border-[#6f8fb8]/40 text-xs transition-colors cursor-pointer group"
                    >
                      <span className="text-[#6f8fb8] font-medium block truncate group-hover:text-white">Dean's Office</span>
                      <span className="text-[10px] text-[#acb5c3] font-mono block">admin · Admin@123</span>
                    </button>
                  </div>
                </div>

                {/* Compact Rule Reference */}
                <div className="mt-auto pt-4 border-t border-slate-800/80 text-[11px] text-[#acb5c3] space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#acb5c3]/70 block font-semibold">
                    Rule Credential Formulas:
                  </span>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-800/40">
                    <span className="text-[#c9a96b]">Faculty (40)</span>
                    <span className="font-mono text-white/90">ID (F01–F40) · &lt;ID&gt;@123</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-800/40">
                    <span className="text-[#5fa8a0]">Coordinators (9)</span>
                    <span className="font-mono text-white/90">Dept (CSE, ECE...) · Coord@&lt;DEPT&gt;123</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-800/40">
                    <span className="text-[#c27d5e]">Clubs (11)</span>
                    <span className="font-mono text-white/90">Slug (dance, coding...) · Club@&lt;Slug&gt;123</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-[#6f8fb8]">Admin (2)</span>
                    <span className="font-mono text-white/90">admin, admin2 · Admin@123</span>
                  </div>
                </div>
              </div>

              {/* Right Panel: Full Campus Directory (62 Accounts) */}
              <div className={`flex-1 flex flex-col min-h-0 p-5 sm:p-6 bg-[#080d19] overflow-hidden ${
                mobileView === 'directory' ? 'flex' : 'hidden lg:flex'
              }`}>
                {/* Directory Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80 flex-shrink-0">
                  <div>
                    <h3 className="text-xl font-serif text-[#f1ece1] font-normal">
                      Campus Members Directory
                    </h3>
                    <p className="text-xs text-[#acb5c3]">
                      Browse all 62 dataset members. Use "Fill Form" to populate credentials or "Sign In ⚡" for instant access.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-[#c9a96b]/15 text-[#c9a96b] border border-[#c9a96b]/30 whitespace-nowrap">
                      62 Verified Accounts
                    </span>
                  </div>
                </div>

                {/* Role Filters & Search */}
                <div className="pt-3 pb-2 space-y-2.5 flex-shrink-0">
                  {/* Role Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {(['all', 'faculty', 'coordinator', 'club', 'admin'] as const).map(tab => {
                      const label = tab === 'all' ? 'All (62)' : tab === 'faculty' ? 'Faculty (40)' : tab === 'coordinator' ? 'Coordinators (9)' : tab === 'club' ? 'Clubs (11)' : 'Admin (2)';
                      const isActive = activeDirectoryTab === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => {
                            setActiveDirectoryTab(tab);
                            setSearchQuery('');
                          }}
                          className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                            isActive
                              ? 'bg-[#c9a96b] text-[#0a1220] font-semibold shadow-sm'
                              : 'bg-[#0f172a] text-[#acb5c3] hover:text-[#f1ece1] border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Live Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search 62 accounts by name, faculty ID (e.g. F06), department (CSE), club, or email..."
                      className="w-full pl-9 pr-8 py-2 bg-[#050912] border border-slate-700 focus:border-[#c9a96b] rounded-sm text-xs text-[#f1ece1] placeholder-[#acb5c3]/45 focus:outline-none transition-colors"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#acb5c3]">
                      🔍
                    </span>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#acb5c3] hover:text-white cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Readout */}
                  <div className="flex items-center justify-between text-[11px] text-[#acb5c3] px-0.5">
                    {(() => {
                      const baseList = activeDirectoryTab === 'all'
                        ? ALL_ACCOUNTS
                        : (ACCOUNTS_DATA[activeDirectoryTab] || []);
                      const q = searchQuery.toLowerCase().trim();
                      const filtered = q
                        ? baseList.filter((a: AccountItem) =>
                            a.name.toLowerCase().includes(q) ||
                            a.email.toLowerCase().includes(q) ||
                            (a.faculty_id && a.faculty_id.toLowerCase().includes(q)) ||
                            (a.department && a.department.toLowerCase().includes(q)) ||
                            (a.club_name && a.club_name.toLowerCase().includes(q)) ||
                            a.identifier.toLowerCase().includes(q)
                          )
                        : baseList;

                      return (
                        <>
                          <span>
                            Showing <strong className="text-white">{filtered.length}</strong> of {baseList.length} members
                          </span>
                          <span className="text-[#acb5c3]/60 hidden sm:inline">
                            Click "Fill Form" to populate left panel
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Member Cards Scrollable List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 divide-y divide-slate-800/40">
                  {(() => {
                    const baseList = activeDirectoryTab === 'all'
                      ? ALL_ACCOUNTS
                      : (ACCOUNTS_DATA[activeDirectoryTab] || []);
                    const q = searchQuery.toLowerCase().trim();
                    const filtered = q
                      ? baseList.filter((a: AccountItem) =>
                          a.name.toLowerCase().includes(q) ||
                          a.email.toLowerCase().includes(q) ||
                          (a.faculty_id && a.faculty_id.toLowerCase().includes(q)) ||
                          (a.department && a.department.toLowerCase().includes(q)) ||
                          (a.club_name && a.club_name.toLowerCase().includes(q)) ||
                          a.identifier.toLowerCase().includes(q)
                        )
                      : baseList;

                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-12 text-xs text-[#acb5c3] space-y-2">
                          <p>No members matched "{searchQuery}".</p>
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="text-[#c9a96b] underline cursor-pointer"
                          >
                            Clear search filter
                          </button>
                        </div>
                      );
                    }

                    return filtered.map((acc: AccountItem) => (
                      <div
                        key={acc.id}
                        className="p-3 bg-[#0d1627]/70 hover:bg-[#111c33] border border-slate-800/90 hover:border-[#c9a96b]/40 rounded-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-[#f1ece1] group-hover:text-white">
                              {acc.name}
                            </span>
                            {acc.faculty_id && (
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#c9a96b]/20 text-[#c9a96b] border border-[#c9a96b]/30">
                                {acc.faculty_id}
                              </span>
                            )}
                            {acc.department && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25">
                                {acc.department}
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase font-mono ${
                              acc.role === 'admin' ? 'bg-[#6f8fb8]/20 text-[#6f8fb8] border border-[#6f8fb8]/30' :
                              acc.role === 'department_coordinator' ? 'bg-[#5fa8a0]/20 text-[#5fa8a0] border border-[#5fa8a0]/30' :
                              acc.role === 'faculty' ? 'bg-[#c9a96b]/20 text-[#c9a96b] border border-[#c9a96b]/30' :
                              'bg-[#c27d5e]/20 text-[#c27d5e] border border-[#c27d5e]/30'
                            }`}>
                              {acc.role === 'department_coordinator' ? 'Coordinator' : acc.role}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-[#acb5c3] font-mono flex-wrap">
                            <span>{acc.email}</span>
                            <span>·</span>
                            <span className="text-[#c9a96b]/90 bg-[#c9a96b]/10 px-1 py-0.2 rounded border border-[#c9a96b]/20">
                              Rule Pwd: {acc.rule_password}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => fillFormCredentials(acc.faculty_id || acc.identifier || acc.email, acc.rule_password)}
                            className="px-2.5 py-1.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-[#f1ece1] text-xs font-medium border border-slate-700 hover:border-[#c9a96b]/40 transition-all cursor-pointer flex items-center gap-1"
                            title="Populate this member's ID & rule password in the form"
                          >
                            <span>Fill Form ↗</span>
                          </button>
                          <button
                            type="button"
                            disabled={isLoggingIn}
                            onClick={() => handleAccountLogin(acc)}
                            className="px-2.5 py-1.5 rounded-sm bg-[#c9a96b]/20 hover:bg-[#c9a96b] hover:text-[#0a1220] text-[#c9a96b] font-semibold text-xs border border-[#c9a96b]/35 transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                            title="Direct 1-Click Sign In"
                          >
                            {isLoggingIn && activeRoleLoggingIn === acc.name ? (
                              <span>Signing in...</span>
                            ) : (
                              <span>Sign In ⚡</span>
                            )}
                          </button>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Logging-in overlay indicator */}
      {isLoggingIn && !modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1220]/80 backdrop-blur-sm">
          <div className="bg-[#101b2b] border border-[#c9a96b88] rounded-sm p-6 shadow-2xl flex items-center gap-4 text-[#f1ece1]">
            <div className="w-5 h-5 border-2 border-[#c9a96b] border-t-transparent rounded-full animate-spin"></div>
            <div className="text-sm font-medium">
              Signing in as {activeRoleLoggingIn}...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
