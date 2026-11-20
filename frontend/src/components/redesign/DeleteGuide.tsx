'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Ellipsis, Trash2 } from 'lucide-react';
import { actorId, isOwner, type Instruction } from '@shared/community';
import { useStore } from './store';
import styles from './DeleteGuide.module.css';

export function DeleteGuide({ guide, onDeleted }: { guide: Instruction; onDeleted?: () => void }) {
  const { data, profile, send, notify } = useStore();
  if (!profile) return null;
  const team = data.teams.find(item => item.id === guide.teamId);
  const local = guide.id === 'new';
  const owner = isOwner(guide, profile);
  if (!local && (guide.teamId ? !team?.active || (!owner && team.ownerId !== actorId(profile)) : !owner)) return null;

  async function remove() {
    if (!local) {
      const result = await send({ type: 'delete-guide', guideId: guide.id, status: guide.status, revision: guide.revision ?? 0 });
      if (!result) return false;
      notify('Инструкция удалена');
    }
    onDeleted?.();
    return true;
  }
  return <DeleteAction guide={guide} remove={remove} />;
}

function DeleteAction({ guide, remove }: { guide: Instruction; remove: () => Promise<boolean> }) {
  const { pending, error } = useStore();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  const local = guide.id === 'new';
  const action = local ? 'Выбросить черновик' : 'Удалить инструкцию';
  const impact = local ? 'Введённый текст будет потерян.' : guide.status === 'published'
    ? 'Читатели потеряют доступ по ссылке. Восстановить инструкцию будет нельзя.'
    : guide.status === 'pending' ? 'Инструкция исчезнет из очереди проверки. Восстановить её будет нельзя.'
    : 'Восстановить текст и шаги после удаления будет нельзя.';

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!container.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  return <div ref={container} className={styles.actions} onBlur={e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  }} onKeyDown={e => {
    if (open && e.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={`Действия с инструкцией «${guide.title || 'Без названия'}»`} title="Действия с инструкцией"
      aria-expanded={open} aria-controls={id} disabled={pending} onClick={() => setOpen(!open)}><Ellipsis size={20} /></button>
    <div id={id} hidden={!open} className={styles.menu}>
      <button type="button" onClick={() => {
        setFailed(false); setOpen(false); dialog.current?.showModal(); cancel.current?.focus();
      }}><Trash2 size={16} />{action}</button>
    </div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={id + '-title'} aria-describedby={id + '-guide ' + id + '-impact'}
      onClose={() => trigger.current?.focus()} onCancel={e => { if (pending) e.preventDefault(); }}>
      <h2 id={id + '-title'}>{action}?</h2>
      <strong className={styles.guideName} id={id + '-guide'}>{guide.title.trim() || 'Без названия'}</strong>
      <p id={id + '-impact'}>{impact}</p>
      {failed && <p role="alert">{error || 'Не удалось удалить. Попробуй ещё раз.'}</p>}
      <div className={styles.buttons}>
        <button ref={cancel} className="button button-outline" type="button" disabled={pending} onClick={() => dialog.current?.close()}>Отмена</button>
        <button className={styles.confirm} type="button" disabled={pending} onClick={async () => {
          if (await remove()) dialog.current?.close(); else setFailed(true);
        }}>{pending ? 'Удаляем…' : local ? 'Выбросить' : 'Удалить'}</button>
      </div>
    </dialog>
  </div>;
}
