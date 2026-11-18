import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Instruction } from './community';

export async function downloadGuidePdf(guide: Instruction) {
  const [pdf, fontFiles] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  const content: Content[] = [
    { text: 'StepFlow', style: 'brand' },
    { text: guide.title, style: 'title' },
    { text: [guide.category, guide.author, `~${guide.minutes} мин`].filter(Boolean).join('  /  '), style: 'meta' },
    { text: guide.description, margin: [0, 0, 0, 15] },
  ];
  if (guide.source) content.push({ text: `На основе «${guide.source.title}» · ${guide.source.author}`, style: 'meta' });
  for (const [index, step] of guide.steps.entries()) {
    content.push(
      { text: `${index + 1}. ${step.title || 'Шаг'}`, style: 'step', headlineLevel: 1 },
      { text: step.text, margin: [0, 0, 0, 8] },
    );
    if (step.code) content.push(
      { text: step.filename || 'Код', style: 'meta' },
      { text: step.code, style: 'code' },
    );
    if (step.checks.length) content.push({ ul: [...step.checks], margin: [0, 1, 0, 12] });
  }
  const definition: TDocumentDefinitions = {
    info: { title: guide.title, author: guide.author, subject: guide.description },
    pageSize: 'A4',
    pageMargins: [44, 44, 44, 48],
    defaultStyle: { fontSize: 11, color: '#23262c', lineHeight: 1.22 },
    styles: {
      brand: { bold: true, color: '#cf2b24', fontSize: 13, margin: [0, 0, 0, 12] },
      title: { bold: true, fontSize: 25, margin: [0, 0, 0, 8] },
      meta: { color: '#5b6463', fontSize: 9, margin: [0, 0, 0, 8] },
      step: { bold: true, fontSize: 15, margin: [0, 12, 0, 6] },
      code: { fontSize: 9, background: '#edf1ed', preserveLeadingSpaces: true, margin: [0, 0, 0, 10] },
    },
    pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.length === 0,
    footer: (page, total) => ({ text: `StepFlow  /  ${page} из ${total}`, alignment: 'right', fontSize: 9, color: '#5b6463', margin: [44, 12, 44, 0] }),
    content,
  };
  const vfs = fontFiles.default;
  const filename = guide.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 100) || 'Инструкция';
  await new Promise<void>(resolve => pdf.createPdf(definition, undefined, undefined, vfs).download(`${filename}.pdf`, resolve));
}
