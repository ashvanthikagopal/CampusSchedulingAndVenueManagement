import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { api } from '../services/api';
import '../styles/cit-landing.css';

type RoleKey = 'admin' | 'coordinator' | 'faculty' | 'club';

interface PublicStats {
  sessions_scheduled: number;
  hard_violations: number;
  booking_score: number;
  bookings_count: number;
  last_reschedule_moved_count: number;
}

export const LandingPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Modal and submission state
  const [modalOpen, setModalOpen] = useState(false);
  const [manualIdentifier, setManualIdentifier] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeRoleLoggingIn, setActiveRoleLoggingIn] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Live stats from backend
  const [stats, setStats] = useState<PublicStats | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Handle direct role login
  const handleRoleLogin = async (role: RoleKey) => {
    setIsLoggingIn(true);
    setLoginError(null);
    let identifier = '';
    let password = '';
    let target = '/';
    let label = '';

    if (role === 'admin') {
      identifier = 'admin@cit.edu';
      password = 'Admin@123';
      target = '/';
      label = 'Admin (Dean\'s Office)';
    } else if (role === 'coordinator') {
      identifier = 'coord_cse@cit.edu';
      password = 'Coord@123';
      target = '/timetable';
      label = 'CSE Coordinator';
    } else if (role === 'faculty') {
      identifier = 'faculty_f06@cit.edu';
      password = 'Faculty@123';
      target = '/timetable';
      label = 'Faculty (Dr. Arjun Mehta)';
    } else if (role === 'club') {
      identifier = 'club_dance@cit.edu';
      password = 'Club@123';
      target = '/bookings';
      label = 'Club Rep (Dance Club)';
    }

    setActiveRoleLoggingIn(label);

    try {
      const userData = await login(identifier, password);
      // Route appropriately based on user role
      if (userData.role === 'admin') {
        navigate('/');
      } else if (userData.role === 'department_coordinator') {
        navigate('/timetable');
      } else if (userData.role === 'faculty') {
        navigate('/timetable');
      } else if (userData.role === 'club') {
        navigate('/bookings');
      } else {
        navigate(target);
      }
    } catch (err: any) {
      console.error('Role login failed:', err);
      setLoginError(err.response?.data?.detail || 'Authentication failed. Please verify the backend is running.');
      setIsLoggingIn(false);
      setActiveRoleLoggingIn(null);
    }
  };

  // Handle manual login from modal
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIdentifier.trim() || !manualPassword) {
      setLoginError('Please enter both identifier and password.');
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    setActiveRoleLoggingIn('your account');

    try {
      const userData = await login(manualIdentifier.trim(), manualPassword);
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
      setLoginError(err.response?.data?.detail || 'Invalid email/Faculty ID or password.');
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
        <a className="brand" href="#hero">
          <span id="mark" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          CIT Schedule
        </a>
        <div className="nl">
          <a href="#timetable" data-nav>Timetable</a>
          <a href="#roles" data-nav>Roles</a>
          <a href="#how" data-nav>How it works</a>
          <button className="btn" type="button" onClick={() => setModalOpen(true)}>
            Sign in
          </button>
        </div>
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
            <h2>Four roles. One set of rules.</h2>
            <p className="lead">Each person signs in to the tools they need. Nobody can approve their own request.</p>
            <div className="grid">
              <div style={{ boxShadow: 'inset 0 2px #6f8fb8' }}>
                <h3>Admin</h3>
                <p>The Dean’s office. Generates the timetable, approves changes and any booking that moves a class, and sets the priority order.</p>
                <button
                  type="button"
                  className="role-link"
                  onClick={() => handleRoleLogin('admin')}
                >
                  Sign in as Admin
                </button>
              </div>

              <div style={{ boxShadow: 'inset 0 2px #5fa8a0' }}>
                <h3>Department coordinator</h3>
                <p>Requests changes to department sessions, books rooms for department events, and approves bookings of department labs.</p>
                <button
                  type="button"
                  className="role-link"
                  onClick={() => handleRoleLogin('coordinator')}
                >
                  Sign in as Coordinator
                </button>
              </div>

              <div style={{ boxShadow: 'inset 0 2px #c9a96b' }}>
                <h3>Faculty</h3>
                <p>Views their own timetable, marks when they are unavailable, and requests extra or moved sessions.</p>
                <button
                  type="button"
                  className="role-link"
                  onClick={() => handleRoleLogin('faculty')}
                >
                  Sign in as Faculty
                </button>
              </div>

              <div style={{ boxShadow: 'inset 0 2px #c27d5e' }}>
                <h3>Club representative</h3>
                <p>Submits and cancels venue requests, and sees the status and the reason for every decision.</p>
                <button
                  type="button"
                  className="role-link"
                  onClick={() => handleRoleLogin('club')}
                >
                  Sign in as Club rep
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
          <footer>
            <div>
              <b>CIT Schedule</b>
              Timetable and venue management for Chilika Institute of Technology.
            </div>
            <button
              type="button"
              className="footer-signin"
              onClick={() => setModalOpen(true)}
            >
              Sign in
            </button>
            <p>Built for the CIT campus scheduling hackathon. AI use is declared in AI_USAGE.md.</p>
          </footer>
        </div>
      </main>

      {/* Role Sign-in / Custom Credentials Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a1220]/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => !isLoggingIn && setModalOpen(false)}
        >
          <div
            className="bg-[#0f172a] border border-[#f1ece125] border-t-[#c9a96b] rounded-sm p-6 sm:p-8 max-w-lg w-full shadow-2xl relative text-[#f1ece1]"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-4 right-4 text-[#acb5c3] hover:text-[#f1ece1] text-lg font-mono p-1"
              onClick={() => !isLoggingIn && setModalOpen(false)}
              disabled={isLoggingIn}
            >
              ✕
            </button>

            <h2 className="text-3xl font-serif text-[#f1ece1] mb-1 font-normal">
              Sign in to CIT Schedule
            </h2>
            <p className="text-xs text-[#acb5c3] mb-6 tracking-wide">
              Select your role for 1-click access, or enter your institutional credentials.
            </p>

            {loginError && (
              <div className="mb-5 p-3 bg-red-950/60 border border-red-500/40 rounded text-red-200 text-xs">
                {loginError}
              </div>
            )}

            {/* Quick 1-Click Role Access */}
            <div className="space-y-2 mb-6">
              <span className="text-[10px] uppercase tracking-widest text-[#acb5c3] block mb-2 font-medium">
                Instant Role Access
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={isLoggingIn}
                  onClick={() => handleRoleLogin('admin')}
                  className="flex flex-col text-left p-3 rounded-sm border border-[#6f8fb8]/30 bg-[#6f8fb8]/10 hover:bg-[#6f8fb8]/20 transition-colors"
                >
                  <span className="font-semibold text-xs text-[#6f8fb8]">Admin</span>
                  <span className="text-[11px] text-[#acb5c3] mt-0.5">Dean’s Office</span>
                  <span className="text-[9px] font-mono text-[#acb5c3]/70 mt-1">admin@cit.edu</span>
                </button>

                <button
                  type="button"
                  disabled={isLoggingIn}
                  onClick={() => handleRoleLogin('coordinator')}
                  className="flex flex-col text-left p-3 rounded-sm border border-[#5fa8a0]/30 bg-[#5fa8a0]/10 hover:bg-[#5fa8a0]/20 transition-colors"
                >
                  <span className="font-semibold text-xs text-[#5fa8a0]">Coordinator</span>
                  <span className="text-[11px] text-[#acb5c3] mt-0.5">CSE Dept</span>
                  <span className="text-[9px] font-mono text-[#acb5c3]/70 mt-1">coord_cse@cit.edu</span>
                </button>

                <button
                  type="button"
                  disabled={isLoggingIn}
                  onClick={() => handleRoleLogin('faculty')}
                  className="flex flex-col text-left p-3 rounded-sm border border-[#c9a96b]/30 bg-[#c9a96b]/10 hover:bg-[#c9a96b]/20 transition-colors"
                >
                  <span className="font-semibold text-xs text-[#c9a96b]">Faculty</span>
                  <span className="text-[11px] text-[#acb5c3] mt-0.5">Dr. Arjun Mehta</span>
                  <span className="text-[9px] font-mono text-[#acb5c3]/70 mt-1">faculty_f06@cit.edu</span>
                </button>

                <button
                  type="button"
                  disabled={isLoggingIn}
                  onClick={() => handleRoleLogin('club')}
                  className="flex flex-col text-left p-3 rounded-sm border border-[#c27d5e]/30 bg-[#c27d5e]/10 hover:bg-[#c27d5e]/20 transition-colors"
                >
                  <span className="font-semibold text-xs text-[#c27d5e]">Club Rep</span>
                  <span className="text-[11px] text-[#acb5c3] mt-0.5">Dance Club</span>
                  <span className="text-[9px] font-mono text-[#acb5c3]/70 mt-1">club_dance@cit.edu</span>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#f1ece120]"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-[#0f172a] px-3 text-[#acb5c3] tracking-widest">
                  or sign in with credentials
                </span>
              </div>
            </div>

            {/* Manual Form */}
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#acb5c3] mb-1.5 font-medium">
                  Email or Faculty ID
                </label>
                <input
                  type="text"
                  value={manualIdentifier}
                  onChange={e => setManualIdentifier(e.target.value)}
                  placeholder="e.g. admin@cit.edu or F06"
                  disabled={isLoggingIn}
                  className="w-full px-3 py-2 bg-[#0a1220] border border-[#f1ece130] rounded-sm text-sm text-[#f1ece1] placeholder-[#acb5c3]/50 focus:border-[#c9a96b] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#acb5c3] mb-1.5 font-medium">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={manualPassword}
                    onChange={e => setManualPassword(e.target.value)}
                    placeholder="Enter password"
                    disabled={isLoggingIn}
                    className="w-full px-3 py-2 bg-[#0a1220] border border-[#f1ece130] rounded-sm text-sm text-[#f1ece1] placeholder-[#acb5c3]/50 focus:border-[#c9a96b] focus:outline-none transition-colors pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#acb5c3] hover:text-[#f1ece1]"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full mt-2 py-3 bg-[#c9a96b] hover:bg-[#d8be85] text-[#0a1220] font-semibold text-sm rounded-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoggingIn ? (
                  <span>Authenticating as {activeRoleLoggingIn}...</span>
                ) : (
                  <span>Sign in</span>
                )}
              </button>
            </form>
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
