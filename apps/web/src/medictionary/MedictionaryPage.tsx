import type { Profile } from '@medifyrx/shared';
import { ChatPanel } from '../chat/ChatPanel';
import { PageHead } from '../layout/Shell';

export function MedictionaryPage({ profile }: { profile: Profile }) {
  return (
    <section className="page acc-lav">
      <PageHead icon="book" goal="Conscious learning" title="Medictionary">
        Ask about a medicine, a dosage term or a word you heard at an appointment, and get a short, plain-language
        answer.
      </PageHead>

      <ChatPanel profile={profile} />
    </section>
  );
}
