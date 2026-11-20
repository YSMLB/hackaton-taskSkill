'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Check, CheckCheck, ChevronRight, ClipboardList, GitFork, MessageCircle, Play } from 'lucide-react';
import { LandingHeader, StepBadge } from './Chrome';
import { businessPrice, paidPlans } from '@/data/subscription-plans';
import styles from './SubscriptionPlans.module.css';

const demoSteps = [
  { title: 'Подготовь материалы', text: 'Прежде чем оформлять отчёт, собери всё необходимое в одном месте.', checks: ['Открой задание и методичку', 'Сохрани результаты измерений'] },
  { title: 'Собери результаты', text: 'Перенеси измерения в таблицу. Укажи единицы измерения и подпиши изображения.', checks: ['Заполни таблицу результатов', 'Проверь подписи и единицы измерения'] },
  { title: 'Проверь и сохрани', text: 'Сверь вывод с целью работы и открой готовый файл перед отправкой.', checks: ['Проверь вывод', 'Сохрани и открой итоговый файл'] },
];
export function Landing() {
  const [current, setCurrent] = useState(0);
  const [checks, setChecks] = useState<boolean[][]>([[], [], []]);
  const [finished, setFinished] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState('');
  const demo = demoSteps[current];
  const completed = checks.filter(s => s.filter(Boolean).length === 2).length;
  function advance() { if (checks[current]?.filter(Boolean).length !== 2) { setError('Отметь оба пункта, чтобы перейти дальше.'); return; } setError(''); setHelp(false); if (current < 2) setCurrent(current + 1); else if (completed === 3) setFinished(true); else setCurrent(checks.findIndex(s => s.filter(Boolean).length !== 2)); }
  return <><a href="#main-content" className="skip-link">К содержимому</a><main id="main-content"><section className="hero section-container"><div className="hero-copy"><h1>Разберись в задаче<br />по шагам.</h1><p>Найди инструкцию для учёбы или работы. Выполняй действия по порядку, отмечай готовое и задавай вопросы автору.</p><div className="hero-actions"><Link href="/catalog" className="button button-red">Открыть каталог</Link><a href="#demo" className="button button-outline"><Play size={15} fill="currentColor" />Пройти пример</a></div></div><div className="hero-visual" aria-label="Пример пошагового прохождения"><div className="journey-card"><div className="journey-heading"><span className="journey-icon"><ClipboardList size={24} /></span><span>Подготовить проект<br /><strong>к защите</strong></span><span className="pill light">3 шага</span></div><div className="journey-step completed"><StepBadge number={1} done /><div>Собрать главное<small>Проблема, решение и результат</small></div><Check size={18} /></div><div className="journey-step current"><StepBadge number={2} /><div>Показать, как это работает<small>Добавь демонстрацию проекта</small></div><span className="current-tag">Сейчас</span></div><div className="journey-step upcoming"><StepBadge number={3} /><div>Отрепетировать выступление</div></div><div className="journey-footer"><span>Выполнено</span><span>1 из 3 <CheckCheck size={17} /></span></div><div className="progress-track dark"><span style={{ width: '33%' }} /></div></div></div></section>
    <section className="advantages section-container" id="advantages"><div className="section-heading"><h2>Когда инструкции<br />нужны под рукой</h2><p>Проходи готовые материалы или запиши свой способ решения задачи.</p></div><div className="benefit-grid"><article className="benefit-card"><ClipboardList size={27} /><h3>Не пропускай важное</h3><p>Один шаг за раз, короткое объяснение и чек-лист. Сразу видно, что уже сделано.</p><div className="mini-check"><Check size={16} />Подготовить материалы</div><div className="mini-check muted-check"><span />Проверить результат</div></article><article className="benefit-card"><MessageCircle size={27} /><h3>Разберись с трудным</h3><p>Если что-то не получается, оставь вопрос прямо на шаге. Автор поймёт, где нужна помощь.</p><div className="mini-message">На втором шаге не запускается команда…<span>Вопрос к конкретному действию</span></div></article><article className="benefit-card"><GitFork size={27} /><h3>Передавай опыт дальше</h3><p>Собери собственную инструкцию из действий, примеров и проверок. Её будет проще повторить.</p><div className="mini-path"><span>Идея</span><ChevronRight size={14} /><span>Шаги</span><ChevronRight size={14} /><strong>Результат</strong></div></article></div></section>
    <section className="demo-section section-container" id="demo"><div className="section-heading"><div><h2>Попробуй на примере<br />лабораторного отчёта</h2></div><p>Отметь пункты и перейди к следующему шагу. Регистрация для примера не нужна.</p></div><div className="demo-window"><div className="demo-window-bar"><span>Отчёт по лабораторной</span><Link href="/guide?id=lab-report">Открыть полностью <ArrowUpRight size={15} /></Link></div><div className="demo-body"><aside className="demo-sidebar"><span className="section-label">Твои шаги</span>{demoSteps.map((s, i) => <button key={s.title} className={`step-nav-item ${i === current ? 'active' : ''}`} onClick={() => { setCurrent(i); setFinished(false); setError(''); setHelp(false); }}><StepBadge number={i + 1} done={checks[i]?.filter(Boolean).length === 2} /><span>{s.title}</span></button>)}<div className="demo-progress"><span>Выполнено {completed} из 3</span><div className="progress-track"><span style={{ width: `${completed / 3 * 100}%` }} /></div></div></aside><div className="demo-step"><div className="step-topline"><span className="pill">{finished ? 'Все шаги пройдены' : `Шаг ${current + 1} из 3`}</span><span className="muted">Пример инструкции</span></div><h3>{finished ? 'Пример пройден' : demo.title}</h3><p>{finished ? 'Ты прошёл все шаги. В приложении можно вернуться к инструкции и продолжить работу с другими задачами.' : demo.text}</p>{!finished && <><div className="checklist">{demo.checks.map((s, i) => <label className={checks[current]?.[i] ? 'is-checked' : ''} key={s}><input type="checkbox" checked={checks[current]?.[i] || false} onChange={e => { setChecks(checks.map((a, index) => index === current ? [i === 0 ? e.target.checked : a[0] || false, i === 1 ? e.target.checked : a[1] || false] : a)); setError(''); }} /><span>{s}</span></label>)}</div>{help && <div className="help-note">Начни с файла задания. Если не хватает измерений, уточни их у преподавателя перед оформлением отчёта.</div>}{error && <p className="field-error" role="alert">{error}</p>}<div className="step-actions"><button className="text-button" onClick={() => setHelp(!help)}><MessageCircle size={17} />Нужна подсказка</button><button className="button button-dark" onClick={advance}>{current === 2 ? 'Завершить' : 'Следующий шаг'}<ChevronRight size={17} /></button></div></>}{finished && <div className="step-actions"><button className="text-button" onClick={() => { setChecks([[], [], []]); setCurrent(0); setFinished(false); }}>Начать заново</button><Link href="/catalog" className="button button-dark">Посмотреть каталог <ArrowUpRight size={17} /></Link></div>}</div></div></div></section>
    <section className={`section-container ${styles.landing}`} id="subscriptions" aria-labelledby="subscriptions-title">
      <div className={styles.landingIntro}>
        <h2 id="subscriptions-title">Подписки StepFlow</h2>
        <p>Бесплатно можно проходить инструкции и сохранить до 10 своих. Если нужно больше места, попробуй Plus на месяц. Для совместной работы есть Бизнес.</p>
        <Link href="/subscriptions" className="button button-dark">Посмотреть тарифы <ArrowUpRight size={17} aria-hidden="true" /></Link>
        <p className={styles.demoNote}>В демо тарифы можно попробовать без оплаты.</p>
      </div>
      <div className={styles.landingPlans}>
        {paidPlans.map(plan => <article key={plan.id} className={styles.landingPlan}>
          <h3>{plan.name}</h3>
          <p>{plan.id === 'standard'
            ? 'Создавай личные инструкции и форки без лимита. После назначения экспертом сможешь оставлять рецензии и отмечать проверенные материалы.'
            : 'Собери инструкции для онбординга и рабочих задач в закрытом пространстве. Редактируйте их вместе и публикуйте без лимита. Подписка нужна только владельцу команды.'}</p>
          {plan.id === 'business' && <p className={styles.price}>{businessPrice}</p>}
        </article>)}
      </div>
    </section>
    <section className="landing-end section-container"><div><h2>Уже знаешь, как это сделать?</h2><p>Преврати свой опыт в инструкцию, которая поможет другим.</p></div><Link href="/editor" className="button button-red">Создать инструкцию</Link></section></main><LandingHeader dock /></>;
}
