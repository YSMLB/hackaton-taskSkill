'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { ArrowUpRight, Check, ChevronsLeft, ChevronsRight, Download, LayoutGrid, Menu, Plus, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { useStore } from './store';
import { RegistrationForm, type AuthMode } from './RegistrationForm';
import { isAdmin } from '@shared/community';
import styles from './Chrome.module.css';
import { ProfileAvatar } from './ProfileAvatar';
import { NotificationMenu } from './NotificationMenu';

type AppSection = 'catalog' | 'library' | 'author' | 'moderation' | 'profile' | 'team';

export function Logo({ href = '/' }: { href?: string }) {
  return <Link className="brand" href={href} aria-label={href === '/catalog' ? 'StepFlow — каталог инструкций' : 'StepFlow — главная'}><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>StepFlow<span className="logo-dot">.</span></Link>;
}

function useHeaderMenu() {
  const [menu, setMenu] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu) { setMenu(false); menuButton.current?.focus(); }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);
  return { menu, setMenu, menuButton };
}

function AccountDialog({ dialogRef, mode = 'register', onModeChange }: { dialogRef: RefObject<HTMLDialogElement | null>; mode?: AuthMode; onModeChange?: (mode: AuthMode) => void }) {
  const router = useRouter();
  function close() { dialogRef.current?.close(); }
  return <dialog ref={dialogRef} className="account-dialog" aria-label={mode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}>
    <button className="icon-button dialog-close" aria-label="Закрыть окно" onClick={close}><X /></button>
    {<RegistrationForm mode={mode} onModeChange={onModeChange} onComplete={() => { close(); router.push('/catalog'); }} />}
  </dialog>;
}

export function LandingHeader({ dock = false }: { dock?: boolean }) {
  const { menu, setMenu, menuButton } = useHeaderMenu();
  const { profile, ready } = useStore();
  const [mode, setMode] = useState<AuthMode>('register');
  const [atFooter, setAtFooter] = useState(false);
  const footer = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  function openAccount(nextMode: AuthMode = 'register') { setMode(nextMode); setMenu(false); dialog.current?.showModal(); }

  useEffect(() => {
    if (!dock || !footer.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setAtFooter(entry.isIntersecting);
    }, { rootMargin: '0px 0px -100px 0px' });
    observer.observe(footer.current);
    return () => observer.disconnect();
  }, [dock]);

  const bar = <div className={`site-header${dock ? ' ' + styles.dockBar : ''}`}>
    <div className="header-inner">
      <Logo />
      {!dock && <nav className="desktop-nav" aria-label="О платформе"><Link href="/#advantages">Почему StepFlow</Link><Link href="/#demo">Демо</Link></nav>}
      <div className="header-actions">
        {profile ? <><Link className={`text-button ${styles.landingLogin}`} href="/profile"><UserRound size={17} />Профиль</Link><Link className="button button-dark header-cta" href="/catalog">Открыть каталог <ArrowUpRight size={17} /></Link></> : <><button className={`text-button ${styles.landingLogin}`} onClick={() => openAccount('login')} disabled={!ready}>Войти</button><button className="button button-dark header-cta" onClick={() => openAccount('register')} disabled={!ready}>Регистрация <ArrowUpRight size={17} /></button></>}
        <button ref={menuButton} className="icon-button mobile-menu-button" aria-label={menu ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menu} aria-controls="landing-mobile-nav" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
      </div>
    </div>
    {menu && <nav className="mobile-nav" id="landing-mobile-nav" aria-label="Мобильная навигация лендинга" onClick={() => setMenu(false)}>
      <Link href="/#advantages">Почему StepFlow</Link><Link href="/#demo">Попробовать демо</Link>
      {profile ? <><Link href="/catalog">Открыть каталог</Link><Link href="/profile">Мой профиль</Link></> : <><button onClick={() => openAccount('login')}>Войти</button><button onClick={() => openAccount('register')}>Регистрация</button></>}
    </nav>}
  </div>;

  return <>
    {dock ? <footer className={styles.landingFooter} ref={footer} data-expanded={atFooter}>
      {bar}
    </footer> : <>
      <a href="#main-content" className="skip-link">К содержимому</a>
      <header className={styles.gateHeader} aria-label="Лендинг StepFlow">{bar}</header>
    </>}
    <AccountDialog dialogRef={dialog} mode={mode} onModeChange={setMode} />
  </>;
}

const sidebarCollapseKey = 'stepflow:sidebar-collapsed';
const sidebarWidthKey = 'stepflow:sidebar-width';
const sidebarChanged = 'stepflow:sidebar-changed';
const defaultSidebarWidth = 232;
const minSidebarWidth = 208;
const maxSidebarWidth = 320;
const collapseWidth = 140;

function subscribeSidebar(callback: () => void) {
  window.addEventListener(sidebarChanged, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(sidebarChanged, callback);
    window.removeEventListener('storage', callback);
  };
}

function readSidebar() { return localStorage.getItem(sidebarCollapseKey) === 'true'; }

function clampSidebarWidth(width: number) {
  return Math.min(maxSidebarWidth, Math.max(minSidebarWidth, Math.round(width)));
}

function readSidebarWidth() {
  const saved = Number(localStorage.getItem(sidebarWidthKey) ?? defaultSidebarWidth);
  return Number.isFinite(saved) ? clampSidebarWidth(saved) : defaultSidebarWidth;
}

function saveSidebarPreference(key: string, value: string | number | boolean) {
  localStorage.setItem(key, String(value));
  window.dispatchEvent(new Event(sidebarChanged));
}

export function WorkShell({ active, children }: { active: AppSection; children: React.ReactNode }) {
  const { menu, setMenu, menuButton } = useHeaderMenu();
  const savedCollapsed = useSyncExternalStore(subscribeSidebar, readSidebar, () => false);
  const savedWidth = useSyncExternalStore(subscribeSidebar, readSidebarWidth, () => defaultSidebarWidth);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragStart = useRef<{ x: number; width: number } | null>(null);
  const collapsed = dragWidth === null ? savedCollapsed : dragWidth < collapseWidth;
  const sidebarWidth = dragWidth === null ? savedWidth : clampSidebarWidth(dragWidth);
  const { profile } = useStore();
  const personal = ['profile', 'author', 'library'].includes(active);
  const groups = [
    { label: 'Инструкции', links: [
      { href: '/catalog', label: 'Каталог', current: active === 'catalog', Icon: LayoutGrid },
      { href: '/offline', label: 'Офлайн', current: false, Icon: Download },
    ] },
    { label: 'Аккаунт', links: [
      { href: '/profile', label: 'Мой профиль', current: personal, Icon: UserRound },
      { href: '/team', label: 'Подписки и команды', current: active === 'team', Icon: Users },
    ] },
  ];
  if (isAdmin(profile)) {
    groups.push({ label: 'Модерация', links: [
      { href: '/moderation', label: 'На проверке', current: active === 'moderation', Icon: ShieldCheck },
    ] });
  }

  function startResize(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const width = collapsed ? 64 : sidebarWidth;
    dragStart.current = { x: event.clientX, width };
    setDragWidth(width);
  }
  function widthAtPointer(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    return start ? Math.min(maxSidebarWidth, Math.max(64, start.width + event.clientX - start.x)) : null;
  }
  function cancelResize() {
    dragStart.current = null;
    setDragWidth(null);
  }
  function finishResize(event: PointerEvent<HTMLDivElement>) {
    const width = widthAtPointer(event);
    if (width !== null) {
      if (width >= collapseWidth) saveSidebarPreference(sidebarWidthKey, clampSidebarWidth(width));
      saveSidebarPreference(sidebarCollapseKey, width < collapseWidth);
    }
    cancelResize();
  }
  function resizeWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    let width: number;
    switch (event.key) {
      case 'ArrowLeft': width = collapsed || sidebarWidth === minSidebarWidth ? 64 : sidebarWidth - 12; break;
      case 'ArrowRight': width = sidebarWidth + 12; break;
      case 'Home': width = minSidebarWidth; break;
      case 'End': width = maxSidebarWidth; break;
      default: return;
    }
    event.preventDefault();
    if (width >= collapseWidth) saveSidebarPreference(sidebarWidthKey, clampSidebarWidth(width));
    saveSidebarPreference(sidebarCollapseKey, width < collapseWidth);
  }

  return <div className={styles.shell} style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties} data-collapsed={collapsed} data-resizing={dragWidth !== null}>
    <a href="#main-content" className="skip-link">К содержимому</a>
    <header className={styles.appHeader} aria-label="Приложение StepFlow">
      <div className={styles.appHeaderInner}>
        <button ref={menuButton} className={styles.appMenuButton} aria-label={menu ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menu} aria-controls="app-navigation" onClick={() => setMenu(!menu)}>{menu ? <X size={21} /> : <Menu size={21} />}</button>
        <Logo href="/catalog" />
        <div className={styles.appActions}>
          <Link className={styles.createButton} href="/editor" aria-label="Создать инструкцию"><Plus size={18} aria-hidden="true" /><span>Создать инструкцию</span></Link>
          <NotificationMenu />
          <Link className={styles.profileButton} href="/profile" aria-label="Открыть профиль" title="Мой профиль"><ProfileAvatar photo={profile?.avatar} name={profile?.name} /></Link>
        </div>
      </div>
    </header>
    {menu && <button className={styles.drawerShade} tabIndex={-1} aria-label="Закрыть навигацию" onClick={() => { setMenu(false); menuButton.current?.focus(); }} />}
    <aside className={styles.sidebar} data-open={menu}>
      <nav id="app-navigation" aria-label="Навигация приложения">
        {groups.map(group => <div className={styles.sidebarGroup} role="group" key={group.label} aria-label={group.label}>
          <p className={styles.groupTitle} aria-hidden="true">{group.label}</p>
          {group.links.map(({ href, label, current, Icon }) => {
            const NavLink = href === '/offline' ? 'a' : Link;
            return <NavLink key={href} href={href} title={collapsed ? label : undefined} aria-current={current ? 'page' : undefined} onClick={() => setMenu(false)}><Icon size={18} aria-hidden="true" /><span>{label}</span></NavLink>;
          })}
        </div>)}
      </nav>
        <button type="button" className={styles.sidebarToggle} onClick={() => saveSidebarPreference(sidebarCollapseKey, !collapsed)} aria-expanded={!collapsed} aria-controls="app-navigation" aria-label={collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар'} title={collapsed ? 'Развернуть сайдбар' : 'Свернуть сайдбар'}>
          {collapsed ? <ChevronsRight size={16} aria-hidden="true" /> : <ChevronsLeft size={16} aria-hidden="true" />}
          <span>{collapsed ? 'Развернуть' : 'Свернуть меню'}</span>
        </button>
      <div
        className={styles.sidebarResize}
        role="separator"
        tabIndex={0}
        title="Потяни, чтобы изменить ширину"
        aria-label="Ширина сайдбара"
        aria-orientation="vertical"
        aria-controls="app-navigation"
        aria-valuemin={64}
        aria-valuemax={maxSidebarWidth}
        aria-valuenow={collapsed ? 64 : sidebarWidth}
        aria-valuetext={collapsed ? 'Сайдбар свёрнут' : `${sidebarWidth} px`}
        onPointerDown={startResize}
        onPointerMove={event => { if (dragStart.current) setDragWidth(widthAtPointer(event)); }}
        onPointerUp={finishResize}
        onLostPointerCapture={cancelResize}
        onKeyDown={resizeWithKeyboard}
      />
    </aside>
    <main id="main-content" className={styles.workspaceContent}>{children}</main>
  </div>;
}

export function RegistrationGate() {
  const [mode, setMode] = useState<AuthMode>('register');
  const router = useRouter();
  return <><LandingHeader /><main id="main-content" className="registration-gate"><div className="registration-intro"><span className="section-label">Твоё пространство в StepFlow</span><h1>{mode === 'login' ? 'Продолжим с того же места.' : 'Сначала познакомимся.'}</h1><p>Войди или создай профиль, чтобы открыть каталог, проходить инструкции и сохранять свои материалы.</p><Link className="back-link" href="/">Вернуться на лендинг</Link></div><div className="registration-panel"><RegistrationForm mode={mode} onModeChange={setMode} onComplete={() => router.replace('/catalog')} /></div></main></>;
}

export function StepBadge({ number, done }: { number: number; done?: boolean }) {
  return <span className={`step-number ${done ? 'done' : ''}`}>{done ? <Check size={15} /> : number}</span>;
}
