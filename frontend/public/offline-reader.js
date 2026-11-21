// The offline reader must boot without Next.js chunks or server requests.
const libraryKey = 'stepflow-offline-guides-v1';
const main = document.querySelector('main');
function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function button(label, action) {
  const node = element('button', label);
  node.onclick = action;
  return node;
}
async function entries() {
  const stored = localStorage.getItem(libraryKey);
  return stored === null ? (await fetch('/offline-example.json')).json() : JSON.parse(stored);
}
let removed;
async function showLibrary() {
  main.replaceChildren();
  const items = await entries();
  if (!items.length) main.append(element('p', 'Сохранённых инструкций пока нет.'));
  if (removed) main.append(button('Отменить удаление', async () => {
    const current = await entries();
    if (!current.some(entry => entry.guide.id === removed.guide.id)) {
      localStorage.setItem(libraryKey, JSON.stringify([removed, ...current]));
    }
    removed = undefined;
    await showLibrary();
  }));
  for (const item of items) {
    const row = document.createElement('section');
    row.append(button(item.guide.title, () => showGuide(item)), button('Удалить копию', async () => {
      const current = await entries();
      localStorage.setItem(libraryKey, JSON.stringify(current.filter(entry => entry.guide.id !== item.guide.id)));
      removed = item;
      await showLibrary();
    }));
    main.append(row);
  }
}
function showGuide(item) {
  const { guide } = item;
  main.replaceChildren(button('К сохранённым инструкциям', showLibrary), element('h2', guide.title), element('p', guide.description));
  for (const [index, step] of guide.steps.entries()) {
    const section = document.createElement('section');
    section.append(element('h3', (index + 1) + '. ' + step.title), element('p', step.text));
    if (step.code) section.append(element('pre', step.code));
    for (const [i, check] of step.checks.entries()) {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = item.checked[step.id]?.includes(i) || false;
      box.onchange = async () => {
        try {
          const items = await entries();
          const copy = items.find(entry => entry.guide.id === guide.id);
          if (!copy) return showLibrary();
          const ticks = new Set(copy.checked[step.id]);
          if (box.checked) ticks.add(i); else ticks.delete(i);
          copy.checked[step.id] = [...ticks];
          localStorage.setItem(libraryKey, JSON.stringify(items));
          item.checked = copy.checked;
        } catch {
          box.checked = !box.checked;
          section.append(element('p','Не удалось сохранить отметку на устройстве.'));
        }
      };
      label.append(box, document.createTextNode(' ' + check));
      section.append(label);
    }
    main.append(section);
  }
}
showLibrary().catch(() => main.append(element('p', 'Не удалось открыть сохранённые инструкции.')));
