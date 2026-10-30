export interface LearningChapter {
  id: string;
  title: string;
  purpose: string;
  commands: string;
  outcome: string;
  missionIds: readonly string[];
}

export const learningChapters: readonly LearningChapter[] = [
  {
    id:'terminal', title:'Terminal i pierwsza flaga',
    purpose:'Zrozumiesz ścieżki, katalogi i to, jak odnaleźć ukryty plik.',
    commands:'pwd · ls · cd · mkdir · touch · cat',
    outcome:'Samodzielnie poruszasz się po wirtualnym Linuxie.',
    missionIds:['orientation','workspace','hidden-flag']
  },
  {
    id:'investigation', title:'Pliki i śledztwa',
    purpose:'Nauczysz się odnajdywać dane, filtrować logi i zabezpieczać dowody.',
    commands:'grep · find · cp · mv · rm',
    outcome:'Umiesz znaleźć wskazany ślad i zachować jego kopię.',
    missionIds:['log-hunt','evidence-search','backup-evidence','safe-cleanup','transfer-investigation']
  },
  {
    id:'permissions', title:'Bezpieczeństwo plików',
    purpose:'Sprawdzisz, dlaczego dostęp jest zablokowany i jak ustawić minimalne uprawnienia.',
    commands:'ls -l · stat · chmod',
    outcome:'Rozpoznajesz i poprawiasz prawa rwx.',
    missionIds:['file-hardening','permission-recovery']
  },
  {
    id:'operations', title:'Procesy i usługi',
    purpose:'Dowiesz się, jak znaleźć proces oraz wykryć przyczynę awarii usługi.',
    commands:'ps · kill · systemctl · journalctl',
    outcome:'Potrafisz przeprowadzić prostą diagnostykę usługi.',
    missionIds:['runaway-process','web-service-recovery']
  },
  {
    id:'network', title:'Sieć i troubleshooting',
    purpose:'Połączysz IP, podsieć, bramę, DNS, ARP i porty TCP w analizie jednej awarii.',
    commands:'ip · ping · ss · nslookup · nc · trace',
    outcome:'Wskazujesz etap, na którym połączenie przestaje działać.',
    missionIds:['gateway-repair','api-listener','dns-repair','packet-layers']
  },
  {
    id:'soc-capstone',title:'SOC: pełne śledztwo',
    purpose:'Połączysz rozpoznanie incydentu, ochronę oryginałów, kopiowanie warunkowe i raportowanie.',
    commands:'grep · test · && · cp · > · >> · cat',
    outcome:'Korelujesz ślady, oceniasz hipotezy, usuwasz przyczyny i weryfikujesz bezpieczeństwo naprawy.',
    missionIds:['incident-correlation','incident-hypotheses','incident-response']
  }
];

export type ChapterStatus = 'locked' | 'available' | 'completed';
export interface ChapterProgress extends LearningChapter {
  completedCount: number;
  missionCount: number;
  status: ChapterStatus;
  firstIndex: number;
  recommendedIndex: number | null;
}

/** Derive chapter progress from actual mission IDs. Never grant access to a locked mission. */
export function getCurriculum(
  orderedIds: readonly string[],
  completedIds: readonly string[],
  highestUnlockedIndex: number
): ChapterProgress[] {
  const completed = new Set(completedIds);
  return learningChapters.map(chapter => {
    const indices = chapter.missionIds.map(id => orderedIds.indexOf(id)).filter(i => i >= 0);
    const completedCount = chapter.missionIds.filter(id => completed.has(id)).length;
    const missionCount = chapter.missionIds.length;
    const firstIndex = indices[0] ?? -1;
    const availableIndices = indices.filter(i => i <= highestUnlockedIndex);
    const status: ChapterStatus = completedCount === missionCount ? 'completed'
      : availableIndices.length ? 'available' : 'locked';
    const pending = availableIndices.find(i => !completed.has(orderedIds[i]));
    return {
      ...chapter,
      completedCount, missionCount, status, firstIndex,
      recommendedIndex: pending ?? (availableIndices[0] ?? null)
    };
  });
}
