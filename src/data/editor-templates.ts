import type { Step } from '@/lib/community';

type Template = { label: string; category: string; steps: Array<Pick<Step, 'title' | 'checks'>> };

export const editorTemplates: Template[] = [
  { label: 'Учебная работа', category: 'Учёба', steps: [
    { title: 'Подготовь материалы', checks: ['Задание и нужные материалы под рукой'] },
    { title: 'Выполни основную часть', checks: ['Результат оформлен по заданию'] },
    { title: 'Проверь результат', checks: ['Файл открывается и готов к сдаче'] },
  ] },
  { label: 'Настройка программы', category: 'Технологии', steps: [
    { title: 'Проверь требования', checks: ['Устройство и версия системы подходят'] },
    { title: 'Установи и настрой программу', checks: ['Программа запустилась'] },
    { title: 'Проверь работу', checks: ['Пробное действие выполнено'] },
  ] },
  { label: 'Сборка и проверка', category: 'Быт', steps: [
    { title: 'Подготовь детали и инструменты', checks: ['Все детали и инструменты на месте'] },
    { title: 'Собери по порядку', checks: ['Детали закреплены'] },
    { title: 'Испытай результат', checks: ['Сборка работает в обычном режиме'] },
  ] },
];
