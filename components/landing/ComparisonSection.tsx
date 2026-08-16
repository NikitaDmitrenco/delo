import { X, Check } from "lucide-react";

export function ComparisonSection() {
  return (
    <section className="py-16 border-t border-zinc-900 w-full text-center">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Сравните подход к созданию задач
        </h2>
        <p className="text-zinc-400 text-sm mt-2 max-w-lg mx-auto">
          Обычные приложения заставляют вас быть секретарем. Delo делает всё за вас.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 text-left">
          {/* Old way */}
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-850">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
              <span className="w-5 h-5 rounded-full bg-red-950/60 border border-red-800 flex items-center justify-center text-red-400">
                <X className="w-3 h-3" />
              </span>
              <span>Классические таск-менеджеры</span>
            </div>

            <div className="space-y-2.5 text-xs text-zinc-400">
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <span>1. Открыть форму создания</span>
                <span className="text-zinc-500">Обязательно</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <span>2. Напечатать название</span>
                <span className="text-zinc-500">Ручной ввод</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <span>3. Открыть календарь и выбрать день</span>
                <span className="text-zinc-500">3 клика</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <span>4. Выбрать время в селекторе</span>
                <span className="text-zinc-500">2 клика</span>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <span>5. Выбрать категорию, тег и приоритет</span>
                <span className="text-zinc-500">Усталость от решений</span>
              </div>
            </div>

            <div className="mt-4 text-xs text-zinc-500 text-center">
              ⏱️ Среднее время: ~35 секунд на задачу
            </div>
          </div>

          {/* Delo way */}
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 relative shadow-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-white uppercase tracking-wider mb-4">
              <span className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400">
                <Check className="w-3 h-3" />
              </span>
              <span>Подход DELO</span>
            </div>

            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-zinc-200 mb-4">
              <p className="italic text-zinc-300">
                «В пятницу до 17:00 отправить документы бухгалтеру»
              </p>
              <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-emerald-400">
                <span>✓ Заголовок извлечен</span>
                <span>✓ Дедлайн вычислен</span>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Вы просто надиктовываете голосовое или вводите одну фразу. Никаких меню, календарей и выпадающих списков.
            </p>

            <div className="mt-6 text-xs text-emerald-400 font-medium text-center">
              ⚡ Время: 3 секунды
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
