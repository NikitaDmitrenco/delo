import { Mic, ArrowRight, Bot, Database, Check } from "lucide-react";

export function VoiceFlowShowcase() {
  return (
    <section className="py-16 border-t border-zinc-900 w-full text-center">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Как работает голосовой ввод
        </h2>
        <p className="text-zinc-400 text-sm mt-2 max-w-lg mx-auto">
          От идеи до структурированной задачи за пару секунд без заполнения форм.
        </p>

        {/* Steps Flow */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-12 text-left">
          {/* Step 1 */}
          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-sky-400 mb-4">
                <Mic className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Шаг 1</span>
              <h3 className="text-sm font-semibold text-white mt-1">Голосовое сообщение</h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Вы отправляете обычное аудио в чат Telegram-бота.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-amber-400 mb-4">
                <Bot className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Шаг 2</span>
              <h3 className="text-sm font-semibold text-white mt-1">Whisper STT</h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Нейросеть расшифровывает живую речь на русском языке.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-purple-400 mb-4">
                <span className="font-bold text-xs">AI</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Шаг 3</span>
              <h3 className="text-sm font-semibold text-white mt-1">Task Extraction</h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                GPT извлекает действие и вычисляет дедлайн по вашему часовому поясу.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-emerald-400 mb-4">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Шаг 4</span>
              <h3 className="text-sm font-semibold text-white mt-1">Готово в базе</h3>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Задача сохранена и мгновенно доступна на сайте и в боте.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
