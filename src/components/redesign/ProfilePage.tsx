'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { BookOpen, Camera, FolderOpen, LogOut } from 'lucide-react';
import type { Profile } from '@/lib/community';
import { RegistrationGate, WorkShell } from './Chrome';
import { ProfileAvatar } from './ProfileAvatar';
import { localDrafts, useStore } from './store';
import styles from './ProfilePage.module.css';

async function preparePhoto(file: File) {
  const image = await createImageBitmap(file);
  try {
    const edge = Math.min(image.width, image.height);
    const size = Math.min(edge, 384);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = '#f8f8f6';
    context.fillRect(0, 0, size, size);
    context.drawImage(image, (image.width - edge) / 2, (image.height - edge) / 2, edge, edge, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.84);
  } finally {
    image.close();
  }
}

export function ProfilePage() {
  const { profile, ready } = useStore();
  if (!ready) return <div className="page-loading">Открываем профиль…</div>;
  if (!profile) return <RegistrationGate />;
  return <WorkShell active="profile"><ProfileForm key={profile.id} profile={profile} /></WorkShell>;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { send, pending, notify } = useStore();
  const previousDrafts = localDrafts(profile.email);
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [bio, setBio] = useState(profile.bio || '');
  const [avatar, setAvatar] = useState(profile.avatar);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const dirty = name.trim() !== profile.name.trim() || email.trim() !== profile.email.trim() ||
    bio.trim() !== (profile.bio || '') || avatar !== profile.avatar;

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setStatus('');
    setPhotoError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setPhotoError('Выбери фото в JPG, PNG или WebP размером до 10 МБ.');
      return;
    }
    setReadingPhoto(true);
    try {
      setAvatar(await preparePhoto(file));
    } catch {
      setPhotoError('Не удалось открыть фото. Попробуй другой файл.');
    } finally {
      setReadingPhoto(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || readingPhoto) return;
    if (!name.trim() || !email.trim()) { setError('Заполни имя и email.'); return; }
    const result = await send({ type: 'profile', edits: { name, email, bio, avatar } });
    setError('');
    setStatus(result ? 'Изменения сохранены' : '');
  }

  return <div className={styles.page}>
    <h1>Мой профиль</h1>
    <div className={styles.layout}>
      <aside className={styles.summary} aria-label="Мой аккаунт">
        <ProfileAvatar photo={profile.avatar} name={profile.name} size={68} />
        <h2>{profile.name.trim() || 'Участник StepFlow'}</h2>
        <p>{profile.email}</p>
        <span className={styles.role}>{profile.role}</span>
        <nav className={styles.links} aria-label="Мои разделы">
          <Link href="/library"><BookOpen size={18} aria-hidden="true" />Мои прохождения</Link>
          <Link href="/author"><FolderOpen size={18} aria-hidden="true" />Мои инструкции</Link>
        </nav>
        {previousDrafts.length > 0 && <button className="button button-outline" type="button" disabled={pending} onClick={async () => {
          const result = await send({ type: 'import', guides: previousDrafts.slice(0, 30) });
          if (result) notify(result.count ? 'Инструкции перенесены в черновики' : 'Эти инструкции уже перенесены');
        }}>Перенести старые инструкции</button>}
        <button type="button" className={styles.logout} disabled={pending} onClick={async () => { if (await send({ type: 'logout' })) router.push('/'); }}><LogOut size={18} aria-hidden="true" />Выйти из аккаунта</button>
      </aside>
      <form className={styles.panel} onSubmit={save} onChange={() => { setError(''); setStatus(''); }}>
        <h2>Личные данные</h2>
        <div className={styles.photoRow}>
          <ProfileAvatar photo={avatar} name={name} size={80} />
          <div>
            <div className={styles.photoActions}>
              <label className={styles.upload}>
                <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Загрузить фото" disabled={readingPhoto} onChange={choosePhoto} />
                <Camera size={17} aria-hidden="true" />{readingPhoto ? 'Загружаем…' : avatar ? 'Заменить фото' : 'Загрузить фото'}
              </label>
              {avatar && <button className="text-button" type="button" disabled={readingPhoto} onClick={() => { setAvatar(undefined); setPhotoError(''); setStatus(''); }}>Удалить фото</button>}
            </div>
            <p className={styles.photoHint}>JPG, PNG или WebP до 10 МБ</p>
            {photoError && <p className={styles.error} role="alert">{photoError}</p>}
          </div>
        </div>
        <div className="field">
          <label htmlFor="profile-name">Имя и фамилия</label>
          <input id="profile-name" autoComplete="name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="profile-email">Email</label>
          <input id="profile-email" inputMode="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="profile-bio">О себе</label>
          <textarea id="profile-bio" rows={4} maxLength={400} value={bio} onChange={event => setBio(event.target.value)} placeholder="Например, чем занимаешься и какие инструкции пишешь" />
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.saveRow}>
          <button type="submit" className="button button-red" disabled={!dirty || readingPhoto || pending}>Сохранить изменения</button>
          <p className={styles.status} role="status">{status}</p>
        </div>
      </form>
    </div>
  </div>;
}
