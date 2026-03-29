import type { AuditCategoryId } from './types'

export interface AuditQuestion {
  id: string
  category: AuditCategoryId
  question: string
  placeholder: string
  required: boolean
}

export interface AuditCategory {
  id: AuditCategoryId
  label: string
  description: string
  icon: string   // lucide-react icon name
  questions: AuditQuestion[]
}

export const AUDIT_CATEGORIES: AuditCategory[] = [
  {
    id: 'procesy',
    label: 'Procesy Operacyjne',
    description: 'Manualne przepływy pracy, powtarzalne zadania, straty czasu',
    icon: 'Settings2',
    questions: [
      {
        id: 'proc_1',
        category: 'procesy',
        question: 'Które zadania w firmie są wykonywane ręcznie i powtarzają się codziennie lub co tydzień?',
        placeholder: 'np. ręczne przepisywanie zamówień do Excela, wysyłanie maili potwierdzających...',
        required: true,
      },
      {
        id: 'proc_2',
        category: 'procesy',
        question: 'Ile godzin tygodniowo pracownicy spędzają na zadaniach, które mogłyby być zautomatyzowane?',
        placeholder: 'np. 3 osoby × 6 godzin = 18 godzin tygodniowo...',
        required: true,
      },
      {
        id: 'proc_3',
        category: 'procesy',
        question: 'Gdzie najczęściej dochodzi do błędów lub opóźnień w Waszych procesach?',
        placeholder: 'np. fakturowanie, odbiory magazynowe, raportowanie do zarządu...',
        required: false,
      },
      {
        id: 'proc_4',
        category: 'procesy',
        question: 'Jakie dokumenty lub dane przepisujecie między systemami ręcznie?',
        placeholder: 'np. dane z ERP do Excela, zamówienia z emaila do systemu...',
        required: false,
      },
      {
        id: 'proc_5',
        category: 'procesy',
        question: 'Co byście zrobili z zaoszczędzonym czasem, gdyby te procesy działały automatycznie?',
        placeholder: 'np. więcej czasu na klientów, nowe projekty, rozwój firmy...',
        required: false,
      },
    ],
  },
  {
    id: 'technologia',
    label: 'Technologia i Systemy',
    description: 'Używane narzędzia, system ERP, integracje, problemy techniczne',
    icon: 'Cpu',
    questions: [
      {
        id: 'tech_1',
        category: 'technologia',
        question: 'Z jakiego systemu ERP lub oprogramowania głównego korzystacie? Czy ma API?',
        placeholder: 'np. Comarch ERP, SAP, własny system z lat 90., Subiekt GT...',
        required: true,
      },
      {
        id: 'tech_2',
        category: 'technologia',
        question: 'Jakie narzędzia cyfrowe (aplikacje, SaaS) używacie na co dzień?',
        placeholder: 'np. Excel, Google Workspace, Baselinker, Allegro, własna strona...',
        required: true,
      },
      {
        id: 'tech_3',
        category: 'technologia',
        question: 'Które systemy nie rozmawiają ze sobą i przez to tracicie czas lub dane?',
        placeholder: 'np. CRM nie jest połączony z ERP, zamówienia idą emailem a nie do systemu...',
        required: false,
      },
      {
        id: 'tech_4',
        category: 'technologia',
        question: 'Jakie są największe frustracje związane z obecną technologią?',
        placeholder: 'np. system się wiesza, brak mobilnej wersji, brak raportów na żywo...',
        required: false,
      },
      {
        id: 'tech_5',
        category: 'technologia',
        question: 'Czy próbowaliście już AI lub automatyzacji? Co się nie sprawdziło i dlaczego?',
        placeholder: 'np. próbowaliśmy ChatGPT ale nikt nie używał, mieliśmy RPA ale się zepsuło...',
        required: false,
      },
    ],
  },
  {
    id: 'sprzedaz',
    label: 'Sprzedaż i Marketing',
    description: 'Pozyskiwanie klientów, social media, follow-up, komunikacja',
    icon: 'TrendingUp',
    questions: [
      {
        id: 'sales_1',
        category: 'sprzedaz',
        question: 'Skąd przychodzą nowi klienci? Które kanały działają najlepiej?',
        placeholder: 'np. polecenia, Google, Instagram, targi, zimne telefony...',
        required: true,
      },
      {
        id: 'sales_2',
        category: 'sprzedaz',
        question: 'Jak wygląda follow-up po kontakcie z potencjalnym klientem?',
        placeholder: 'np. ręcznie dzwonimy, maile z Outlooka, nie mamy systemu...',
        required: true,
      },
      {
        id: 'sales_3',
        category: 'sprzedaz',
        question: 'Jak często publikujecie na social mediach i ile czasu zajmuje tworzenie treści?',
        placeholder: 'np. rzadko, jedna osoba robi wszystko, 2 godziny tygodniowo...',
        required: false,
      },
      {
        id: 'sales_4',
        category: 'sprzedaz',
        question: 'Czy wysyłacie newslettery lub kampanie emailowe? Jak często i czym?',
        placeholder: 'np. nie, kiedyś MailChimp ale przestaliśmy, raz na kwartał...',
        required: false,
      },
      {
        id: 'sales_5',
        category: 'sprzedaz',
        question: 'Cel sprzedażowy na 12 miesięcy i co blokuje jego realizację?',
        placeholder: 'np. +30% przychodu, potrzebujemy więcej leadów, nie nadążamy z obsługą...',
        required: false,
      },
    ],
  },
  {
    id: 'obsluga',
    label: 'Obsługa Klienta',
    description: 'Czasy odpowiedzi, kanały kontaktu, wolumen pytań',
    icon: 'Headphones',
    questions: [
      {
        id: 'cs_1',
        category: 'obsluga',
        question: 'Ile telefonów lub wiadomości od klientów odbieracie dziennie? Jak długo trwa odpowiedź?',
        placeholder: 'np. 20-30 telefonów dziennie, maile odpowiadamy następnego dnia...',
        required: true,
      },
      {
        id: 'cs_2',
        category: 'obsluga',
        question: 'Jakie pytania klienci zadają najczęściej? Czy macie FAQ lub bazę wiedzy?',
        placeholder: 'np. pytają o status zamówienia, dostępność, cenniki — nie mamy FAQ...',
        required: true,
      },
      {
        id: 'cs_3',
        category: 'obsluga',
        question: 'Co się dzieje gdy klient dzwoni poza godzinami pracy? Czy tracacie przez to leady?',
        placeholder: 'np. idzie na pocztę głosową, tracimy leady w weekendy...',
        required: false,
      },
      {
        id: 'cs_4',
        category: 'obsluga',
        question: 'Przez jakie kanały klienci kontaktują się z firmą (telefon, email, WhatsApp)?',
        placeholder: 'np. głównie telefon i email, coraz więcej przez WhatsApp...',
        required: false,
      },
      {
        id: 'cs_5',
        category: 'obsluga',
        question: 'Jakie skargi lub problemy klienci zgłaszają najczęściej?',
        placeholder: 'np. za długi czas oczekiwania, nikt nie oddzwonił, błędne informacje...',
        required: false,
      },
    ],
  },
  {
    id: 'dane',
    label: 'Raportowanie i Dane',
    description: 'Śledzenie KPI, proces raportowania, źródła danych',
    icon: 'BarChart3',
    questions: [
      {
        id: 'data_1',
        category: 'dane',
        question: 'Jakie wskaźniki (KPI) śledzi właściciel regularnie? Jak je zbieracie?',
        placeholder: 'np. przychód tygodniowy z Excela, liczba zleceń, marża...',
        required: true,
      },
      {
        id: 'data_2',
        category: 'dane',
        question: 'Jak przygotowujecie raporty miesięczne? Ile czasu to zajmuje?',
        placeholder: 'np. ręcznie zbieramy dane z 3 systemów do Excela — 4 godziny miesięcznie...',
        required: true,
      },
      {
        id: 'data_3',
        category: 'dane',
        question: 'Czy macie dostęp do danych w czasie rzeczywistym, czy operujecie na historycznych?',
        placeholder: 'np. wiemy co było miesiąc temu, ale nie wiemy co dzieje się teraz...',
        required: false,
      },
      {
        id: 'data_4',
        category: 'dane',
        question: 'Jakie decyzje podejmujecie intuicyjnie, bo nie macie danych, żeby je podeprzeć?',
        placeholder: 'np. nie wiemy które produkty są rentowne, nie znamy CAC...',
        required: false,
      },
      {
        id: 'data_5',
        category: 'dane',
        question: 'Gdybyście mieli dashboard "zdrowie firmy" w real-time — co chcielibyście widzieć?',
        placeholder: 'np. dzisiejsze przychody, zamówienia w toku, najlepiej sprzedające produkty...',
        required: false,
      },
    ],
  },
]

// Flat lookup for answer display
export const ALL_QUESTIONS: AuditQuestion[] = AUDIT_CATEGORIES.flatMap(c => c.questions)
export const QUESTION_BY_ID = Object.fromEntries(ALL_QUESTIONS.map(q => [q.id, q]))
