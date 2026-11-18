'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowUpRight, BookOpen, Check, FolderOpen, LayoutGrid, Menu, Download, Plus, ShieldCheck, UserRound, X } from 'lucide-react';
import { useStore } from './store';
import { RegistrationForm, type AuthMode } from './RegistrationForm';
import { isAdmin } from '@shared/community';
import styles from './Chrome.module.css';
import { ProfileAvatar } from './ProfileAvatar';

type AppSection = 'catalog' | 'library' | 'author' | 'moderation' | 'profile';

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

export function LandingHeader() {
  const { menu, setMenu, menuButton } = useHeaderMenu();
  const { profile, ready } = useStore();
  const [mode, setMode] = useState<AuthMode>('register');
  const dialog = useRef<HTMLDialogElement>(null);
  function openAccount(nextMode: AuthMode = 'register') { setMode(nextMode); setMenu(false); dialog.current?.showModal(); }

  return <>
    <a href="#main-content" className="skip-link">К содержимому</a>
    <header className="site-header" aria-label="Лендинг StepFlow">
      <div className="header-inner">
        <Logo />
        <nav className="desktop-nav" aria-label="О платформе"><Link href="/#advantages">Почему StepFlow</Link><Link href="/#demo">Демо</Link></nav>
        <div className="header-actions">
          {profile ? <><Link className={`text-button ${styles.landingLogin}`} href="/profile"><UserRound size={17} />Профиль</Link><Link className="button button-dark header-cta" href="/catalog">Открыть каталог <ArrowUpRight size={17} /></Link></> : <><button className={`text-button ${styles.landingLogin}`} onClick={() => openAccount('login')} disabled={!ready}>Войти</button><button className="button button-dark header-cta" onClick={() => openAccount('register')} disabled={!ready}>Регистрация <ArrowUpRight size={17} /></button></>}
          <button ref={menuButton} className="icon-button mobile-menu-button" aria-label={menu ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menu} aria-controls="landing-mobile-nav" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button>
        </div>
      </div>
      {menu && <nav className="mobile-nav" id="landing-mobile-nav" aria-label="Мобильная навигация лендинга" onClick={() => setMenu(false)}>
        <Link href="/#advantages">Почему StepFlow</Link><Link href="/#demo">Попробовать демо</Link>
        {profile ? <><Link href="/catalog">Открыть каталог</Link><Link href="/profile">Мой профиль</Link></> : <><button onClick={() => openAccount('login')}>Войти</button><button onClick={() => openAccount('register')}>Регистрация</button></>}
      </nav>}
    </header>
    <AccountDialog dialogRef={dialog} mode={mode} onModeChange={setMode} />
  </>;
}

function AppHeader({ active }: { active: AppSection }) {
  const { menu, setMenu, menuButton } = useHeaderMenu();
  const { profile, data } = useStore();
  const links = [
    { id: 'catalog', href: '/catalog', label: 'Каталог', Icon: LayoutGrid },
    { id: 'library', href: '/library', label: 'Мои прохождения', Icon: BookOpen },
    { id: 'author', href: '/author', label: 'Мои инструкции', Icon: FolderOpen },
    ...(isAdmin(profile) ? [{ id: 'moderation', href: '/moderation', label: `На проверке (${data.guides.filter(g => g.status === 'pending').length})`, Icon: ShieldCheck }] : []),
  ];
  return <>
    <a href="#main-content" className="skip-link">К содержимому</a>
    <header className={styles.appHeader} aria-label="Приложение StepFlow">
      <div className={styles.appHeaderInner}>
        <Logo href="/catalog" />
        <nav className={`${styles.appNav} ${menu ? styles.appNavOpen : ''}`} id="app-navigation" aria-label="Навигация приложения">
          {links.map(({ id, href, label, Icon }) => <Link key={id} href={href} aria-current={active === id ? 'page' : undefined} onClick={() => setMenu(false)}><Icon size={17} aria-hidden="true" />{label}</Link>)}
          <a href="/offline"><Download size={17} aria-hidden="true" />Офлайн</a>
        </nav>
        <div className={styles.appActions}>
          <Link className={styles.createButton} href="/editor" aria-label="Создать инструкцию"><Plus size={18} aria-hidden="true" /><span>Создать инструкцию</span></Link>
          <Link className={styles.profileButton} href="/profile" aria-label="Открыть профиль" title="Мой профиль" aria-current={active === 'profile' ? 'page' : undefined} onClick={() => setMenu(false)}><ProfileAvatar photo={profile?.avatar} name={profile?.name} /></Link>
          <button ref={menuButton} className={styles.appMenuButton} aria-label={menu ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menu} aria-controls="app-navigation" onClick={() => setMenu(!menu)}>{menu ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </div>
    </header>
  </>;
}

export function RegistrationGate() {
  const [mode, setMode] = useState<AuthMode>('register');
  const router = useRouter();
  return <><LandingHeader /><main id="main-content" className="registration-gate"><div className="registration-intro"><span className="section-label">Твоё пространство в StepFlow</span><h1>{mode === 'login' ? 'Продолжим с того же места.' : 'Сначала познакомимся.'}</h1><p>Войди или создай профиль, чтобы открыть каталог, проходить инструкции и сохранять свои материалы.</p><Link className="back-link" href="/">Вернуться на лендинг</Link></div><div className="registration-panel"><RegistrationForm mode={mode} onModeChange={setMode} onComplete={() => router.replace('/catalog')} /></div></main></>;
}

export function Footer() {
  return <footer className="site-footer"><Logo /><p>У каждого большого дела есть первый шаг.</p><Link href="/#demo">Попробовать демо <ArrowUpRight size={16} /></Link></footer>;
}

export function WorkShell({ active, children }: { active: AppSection; children: React.ReactNode }) {
  return <><AppHeader active={active} /><main id="main-content" className={`workspace-content ${styles.workspaceContent}`}>{children}</main></>;
}

export function StepBadge({ number, done }: { number: number; done?: boolean }) {
  return <span className={`step-number ${done ? 'done' : ''}`}>{done ? <Check size={15} /> : number}</span>;
}
