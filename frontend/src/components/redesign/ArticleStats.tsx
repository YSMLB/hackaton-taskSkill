import type { ArticleCounts } from '@shared/workspace-data';

type Row = ArticleCounts & { id: string; title: string };
const score = (row: Row) => (row.likes ?? 0) - (row.dislikes ?? 0);

export function ArticleStats({ rows, ranking = false }: { rows: Row[]; ranking?: boolean }) {
  const ordered = [...rows].sort((a, b) => score(b) - score(a) || (b.views ?? 0) - (a.views ?? 0) || a.title.localeCompare(b.title, 'ru'));
  return <section className="article-stats">
    <h2>{ranking ? 'Рейтинг полезности инструкций' : 'Статистика моих инструкций'}</h2>
    <p className="muted">Просмотры — уникальные читатели, открывшие инструкцию. Рейтинг — лайки минус дизлайки.</p>
    {ordered.length ? <div className="article-stats-scroll" tabIndex={0} role="region" aria-label="Статистика по статьям">
      <table><thead><tr>{['Инструкция', 'Просмотры', 'Лайки', 'Дизлайки', 'Комментарии', 'Рейтинг'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{ordered.map(row => <tr key={row.id}><th scope="row">{row.title}</th><td>{row.views ?? 0}</td><td>{row.likes ?? 0}</td><td>{row.dislikes ?? 0}</td><td>{row.commentCount ?? 0}</td><td>{score(row)}</td></tr>)}</tbody></table>
    </div> : <p>Здесь появится статистика твоих инструкций.</p>}
  </section>;
}
