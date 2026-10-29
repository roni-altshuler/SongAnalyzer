import type { LanguageProcessing } from '@/lib/language';
import { languageContext, LANGUAGE_LIMITATION } from '@/lib/analysis/language-context';

export default function LanguageNotice({ processing }: { processing?: LanguageProcessing }) {
  const context = languageContext(processing);
  return (
    <section aria-label="Language context" className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elev2)] px-3 py-3 text-xs leading-relaxed text-[var(--text-med)]">
      <h3 className="font-semibold text-[var(--text-hi)]">{context.title}</h3>
      <p>{context.detail}</p>
      <p>{LANGUAGE_LIMITATION}</p>
    </section>
  );
}
