import Image from 'next/image';
import { UserRound } from 'lucide-react';
import styles from './ProfilePage.module.css';

export function ProfileAvatar({ photo, name, size = 32 }: { photo?: string; name?: string; size?: number }) {
  const initial = Array.from(name?.trim() || '')[0];
  return <span className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
    {photo ? <Image src={photo} alt="" width={size} height={size} unoptimized /> : initial?.toLocaleUpperCase('ru') || <UserRound size={size / 2} />}
  </span>;
}
