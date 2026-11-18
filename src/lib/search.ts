export interface SearchCandidate { id: string; title: string; description: string; category: string; steps: string[] }
const groups = [
  ['docker', 'докер', 'контейнер', 'контейнеры', 'контейнеризация'],
  ['postgresql', 'postgres', 'постгрес', 'база', 'бд'],
  ['отчёт', 'отчет', 'лабораторная', 'лабораторной', 'лаба', 'лабораторную'],
  ['презентация', 'презентацию', 'защита', 'защите', 'выступление', 'слайды'],
];
const normalize = (text: string) => text.toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function searchScore(candidate: SearchCandidate, query: string) {
  const text = normalize(`${candidate.title} ${candidate.description} ${candidate.category} ${candidate.steps.join(' ')}`);
  const words = normalize(query).split(' ').filter(w => w.length > 2);
  if (!words.length) return normalize(query) ? (text.includes(normalize(query)) ? 1 : 0) : 1;
  let score = 0;
  for (const word of words) {
    if (text.includes(word)) score += 3;
    else if (groups.some(group => group.some(t => normalize(t) === word) && group.some(t => text.includes(normalize(t))))) score += 1;
  }
  return score;
}
