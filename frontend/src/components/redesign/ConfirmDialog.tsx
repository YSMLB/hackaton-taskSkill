'use client';

import { useId, useRef, useState } from 'react';
import styles from './DeleteGuide.module.css';

type Confirmation = { title: string; message: string; action: string };

export function useConfirmation() {
  const dialog = useRef<HTMLDialogElement>(null);
  const resolve = useRef<(accepted: boolean) => void>(null);
  const [request, setRequest] = useState<Confirmation>();
  const id = useId();

  function confirm(next: Confirmation) {
    if (dialog.current?.open) return Promise.resolve(false);
    setRequest(next);
    dialog.current?.showModal();
    return new Promise<boolean>(accept => { resolve.current = accept; });
  }

  function finish(accepted: boolean) {
    dialog.current?.close();
    resolve.current?.(accepted);
    resolve.current = null;
  }

  const modal = <dialog ref={dialog} className={styles.dialog} aria-labelledby={id} aria-describedby={id + '-description'}
    onCancel={event => { event.preventDefault(); finish(false); }}>
    <h2 id={id}>{request?.title}</h2>
    <p className={styles.guideName} id={id + '-description'}>{request?.message}</p>
    <div className={styles.buttons}>
      <button type="button" className="button button-outline" autoFocus onClick={() => finish(false)}>Отмена</button>
      <button type="button" className={styles.confirm} onClick={() => finish(true)}>{request?.action}</button>
    </div>
  </dialog>;
  return { confirm, modal };
}
