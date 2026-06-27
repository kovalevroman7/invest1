import { Button } from '@/components/ui/button';

export const Home = () => (
  <section className="flex flex-col items-start gap-4">
    <h1 className="text-2xl font-semibold">Главная</h1>
    <p className="text-muted-foreground">Тестовая страница invest1. Роутинг на react-router работает.</p>
    <div className="flex gap-2">
      <Button>Кнопка shadcn</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
    </div>
  </section>
);
