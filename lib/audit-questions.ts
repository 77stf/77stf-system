import type { AuditCategoryId } from './types'

export interface AuditQuestion {
  id: string
  question: string
  placeholder: string
  required: boolean
}

export interface AuditCategory {
  id: AuditCategoryId
  label: string
  description: string
  questions: AuditQuestion[]
  consultantOnly?: boolean
}

export const AUDIT_CATEGORIES: AuditCategory[] = [
  {
    id: 'procesy',
    label: 'Procesy Operacyjne',
    description: 'Identyfikacja strat czasu i kosztów powtarzalnych czynności',
    questions: [
      {
        id: 'proc_1',
        question: 'Które 3 czynności zajmują NAJWIĘCEJ czasu Twojego zespołu każdego dnia? Opisz każdą konkretnie — kto robi, co robi, jak długo.',
        placeholder: 'Np. "Karolina i Marta codziennie przepisują zamówienia z maila do Subiekta — ok. 15 zamówień × 10 min = 2.5h dziennie. Potem ręczne fakturowanie — kolejna godzina..."',
        required: true,
      },
      {
        id: 'proc_2',
        question: 'Przelicz konkretnie: ile osób × ile godzin dziennie poświęcacie na powtarzalne, manualne zadania? Jaki jest orientacyjny koszt godzinowy pracownika brutto (całkowity koszt pracodawcy)?',
        placeholder: 'Np. "2 osoby × 3h/dzień = 6h × 22 dni = 132h/mies. Koszt godzinowy brutto ~40 PLN. Miesięczna strata operacyjna: 5 280 PLN"',
        required: true,
      },
      {
        id: 'proc_3',
        question: 'Gdzie najczęściej dochodzi do błędów lub konieczności poprawek? Ile czasu zajmuje jeden błąd do naprawienia i jak często się zdarzają?',
        placeholder: 'Np. "Błędne faktury 2×/tydzień — korekta zajmuje 45 min. Błędne stany magazynowe — raz w tygodniu oversale, zwrot i przepraszanie klienta ~2h łącznie"',
        required: false,
      },
      {
        id: 'proc_4',
        question: 'Jakie dane przepisujecie między systemami ręcznie? Podaj konkretne przepływy: z jakiego systemu do jakiego, ile razy dziennie/tygodniowo.',
        placeholder: 'Np. "WooCommerce → Subiekt GT (zamówienia, 10-20 dziennie), Subiekt → Excel (raport tygodniowy), email → Subiekt (B2B, 5-10 dziennie), reklamacje email → plik Excel"',
        required: false,
      },
      {
        id: 'proc_5',
        question: 'Ile zamówień / transakcji / dokumentów przetwarza firma miesięcznie łącznie? Ile % to powtarzalny schemat tego samego procesu?',
        placeholder: 'Np. "Zamówień ~600/mies (400 online + 200 B2B), faktur ~650, reklamacji ~30. Szacuję 85% to ten sam schemat — odbiór → weryfikacja → wpisanie → faktura → wysyłka"',
        required: false,
      },
    ],
  },
  {
    id: 'technologia',
    label: 'Technologia i Systemy',
    description: 'Ocena obecnego stacku, integracji i gotowości na automatyzację',
    questions: [
      {
        id: 'tech_1',
        question: 'Główny system operacyjny firmy (ERP, CRM lub sklep) — podaj nazwę i wersję. Czy ma API? Jaki jest roczny koszt licencji?',
        placeholder: 'Np. "Subiekt GT (InsERT, wersja 2019) — brak API wg dostawcy. Licencja ~2 400 PLN/rok. WooCommerce — ma REST API, własny hosting 300 PLN/mies"',
        required: true,
      },
      {
        id: 'tech_2',
        question: 'Wypisz WSZYSTKIE narzędzia cyfrowe których używacie + ich miesięczny koszt. Osobno zaznacz: za co płacicie ale prawie nie używacie?',
        placeholder: 'Np. "Subiekt GT 200 PLN, Outlook 365 50 PLN, BaseLinker 120 PLN (używamy 30%), Canva 50 PLN (rzadko), MailChimp darmowy (zapomniane hasło)..."',
        required: true,
      },
      {
        id: 'tech_3',
        question: 'Których połączeń między systemami BRAKUJE i ile czasu kosztuje ich brak tygodniowo? Przelicz: h/tyg × stawka × 4 = miesięczna strata.',
        placeholder: 'Np. "WooCommerce ↔ Subiekt: brak = 2h/dzień ręcznego przepisywania × 40 PLN/h × 22 dni = 1 760 PLN/mies. Allegro ↔ Subiekt: oversale raz/tydzień = 8h naprawy/mies"',
        required: false,
      },
      {
        id: 'tech_4',
        question: 'Kto zarządza IT w firmie? Czy mają czas na wdrożenie (konfiguracja, testy, szkolenie)? Czy jest ktoś "od komputerów" wewnętrznie?',
        placeholder: 'Np. "Brak dedykowanego IT — zewnętrzny informatyk raz na kwartał. Właściciel radzi sobie z podstawami. Do wdrożenia potrzebowalibyśmy zewnętrznego wsparcia na ~2 tygodnie"',
        required: false,
      },
      {
        id: 'tech_5',
        question: 'Czy próbowaliście już automatyzacji, integracji lub AI? Co konkretnie, kiedy i dlaczego się nie sprawdziło lub nie zostało wdrożone?',
        placeholder: 'Np. "Student próbował Power Automate do połączenia WooCommerce z Subiektem — upadło po 2 mies. bo Subiekt nie ma API. ChatGPT używa tylko właściciel do tekstów"',
        required: false,
      },
    ],
  },
  {
    id: 'sprzedaz',
    label: 'Sprzedaż i Marketing',
    description: 'Analiza przychodów, utraconych szans i potencjału wzrostu',
    questions: [
      {
        id: 'sales_1',
        question: 'Orientacyjne przychody miesięczne (możesz podać zakres): < 50k / 50-200k / 200-500k / 500k-2M / > 2M PLN. Jaki % to B2C vs B2B?',
        placeholder: 'Np. "200-500k PLN/mies. 75% B2C (sklep online + Allegro), 25% B2B (apteki i sklepy eko). Marże wyższe w B2B ale mniejszy wolumen zamówień"',
        required: true,
      },
      {
        id: 'sales_2',
        question: 'Ilu potencjalnych klientów NIE dostaje follow-upu miesięcznie? Oszacuj wartość utraconą: ile kontaktów × % którzy by kupili × średni koszyk.',
        placeholder: 'Np. "B2B: ~20 zapytań/mies, follow-up dostaje 5. Gdyby 8 z 15 zaniedbanych kupiło: 8 × 3 000 PLN = 24 000 PLN/mies utracone. B2C: po zakupie zero kontaktu z 1 240 klientami"',
        required: true,
      },
      {
        id: 'sales_3',
        question: 'Social media: jak często publikujecie, kto to robi i ile czasu zajmuje jeden post? Czy ktoś śledzi wyniki (zasięgi, kliknięcia, sprzedaż z social)?',
        placeholder: 'Np. "Instagram: raz na 2 tygodnie jak ktoś ma czas. Post zajmuje 1.5h (pisanie + Canva). 2 847 obserwujących, nikt nie śledzi wyników, zero mierzalnej sprzedaży z social"',
        required: false,
      },
      {
        id: 'sales_4',
        question: 'Baza emailowa: ile kontaktów B2C, czy wysyłacie kampanie i jak często? Jaki jest średni koszyk i jak często klient wraca (LTV)?',
        placeholder: 'Np. "1 240 maili z WooCommerce — zero kampanii. Średni koszyk 165 PLN. Klienci wracają średnio raz na 4 miesiące. Nigdy nie wysłaliśmy reaktywacji mimo że mamy kontakty"',
        required: false,
      },
      {
        id: 'sales_5',
        question: 'Cel przychodowy na 12 miesięcy. Co jest GŁÓWNYM blokerem — brak czasu, brak klientów, brak procesów, brak danych, brak ludzi?',
        placeholder: 'Np. "Cel: +40% do końca roku. Bloker 1: handlowcy tracą 40% czasu na obsługę zamówień. Bloker 2: brak CRM — leady giną. Bloker 3: sezonowość bez skalowalności"',
        required: false,
      },
    ],
  },
  {
    id: 'obsluga',
    label: 'Obsługa Klienta',
    description: 'Wolumeny, powtarzalność, utracone przychody poza godzinami pracy',
    questions: [
      {
        id: 'cs_1',
        question: 'Ile kontaktów dziennie obsługujecie łącznie (telefon + email + chat + social)? Ile osób to obsługuje i ile % pytań to te same, powtarzalne tematy?',
        placeholder: 'Np. "30-45 telefonów + 20-30 maili dziennie. Obsługuje głównie Marta (praktycznie cały etat). ~70% pytań to: status zamówienia, dostępność produktu, jak stosować"',
        required: true,
      },
      {
        id: 'cs_2',
        question: 'Wypisz dosłownie TOP 5 pytań które klienci zadają NAJCZĘŚCIEJ — dokładne sformułowania tak jak mówią lub piszą klienci.',
        placeholder: 'Np. "1. Kiedy zamówienie dotrze? 2. Czy macie jeszcze X na stanie? 3. Ile kapsułek dziennie brać? 4. Chcę zwrócić, jak? 5. Jaka różnica między A a B?"',
        required: true,
      },
      {
        id: 'cs_3',
        question: 'Co się dzieje gdy klient dzwoni PO GODZINACH lub w weekend? Oszacuj: ile takich kontaktów/tydzień × ile % by kupiło × średni koszyk = tygodniowa strata.',
        placeholder: 'Np. "Poczta głosowa, większość nie oddzwania. ~15 kontaktów/tydzień, 50% potencjalnych kupujących × 180 PLN koszyk = 1 350 PLN/tydzień = ok. 70 000 PLN/rok"',
        required: false,
      },
      {
        id: 'cs_4',
        question: 'Przez jakie kanały klienci się kontaktują (telefon, email, WhatsApp, Instagram DM, formularz)? Który kanał ROŚNIE najszybciej ostatnio?',
        placeholder: 'Np. "Telefon 60%, email 25%, WhatsApp B2B 10%, formularz 5%. Rośnie: Instagram DM — klienci piszą pod postami i w DM, nikt tego systematycznie nie obsługuje"',
        required: false,
      },
      {
        id: 'cs_5',
        question: 'Jakie skargi zgłaszają klienci najczęściej? Ile % reklamacji kończy się zwrotem lub rekompensatą kosztową? Ile czasu zajmuje obsługa jednej reklamacji?',
        placeholder: 'Np. "Top skargi: brak emaila potwierdzającego, produkt dostępny na stronie a nie ma w magazynie, długi czas odpowiedzi. Zwroty: ~5% zamówień, każdy to ~45 min obsługi"',
        required: false,
      },
    ],
  },
  {
    id: 'dane',
    label: 'Dane i Raportowanie',
    description: 'Jakość danych, czas na raporty i decyzje podejmowane bez informacji',
    questions: [
      {
        id: 'data_1',
        question: 'Jakie wskaźniki (KPI) śledzi właściciel regularnie? Skąd je bierze i z jakim opóźnieniem — widzi co dzieje się DZIŚ czy dane sprzed tygodnia?',
        placeholder: 'Np. "Przychód tygodniowy z piątkowego Excela. Liczba zamówień — muszę zbierać z 3 miejsc ręcznie. Stan magazynu raz na tydzień z Subiekta. Marże per produkt — nigdy"',
        required: true,
      },
      {
        id: 'data_2',
        question: 'Jak powstaje raport miesięczny: kto robi, z ilu źródeł zbiera dane, ile godzin zajmuje i czy zawsze jest na czas?',
        placeholder: 'Np. "Karolina zbiera z WooCommerce (CSV), Allegro (panel), Subiekt (eksport), B2B od handlowców (mail). Łącznie 5-7h + zawsze jakiś błąd. Ostatni spóźnił się o 4 dni"',
        required: true,
      },
      {
        id: 'data_3',
        question: 'Jakie decyzje biznesowe podejmujesz na wyczucie, bo nie masz danych? Co byś zrobił inaczej mając te informacje w czasie rzeczywistym?',
        placeholder: 'Np. "Nie wiem które produkty faktycznie zarabiają po odjęciu zwrotów. Zamówienia od dostawców na przeczucie. Ceny konkurencji sprawdzam raz na kwartał ręcznie"',
        required: false,
      },
      {
        id: 'data_4',
        question: 'Czy monitorujesz ceny i ofertę konkurencji? Jak to robisz, jak często i ile czasu zajmuje? Co z tą wiedzą potem robisz?',
        placeholder: 'Np. "Raz na kwartał wchodzę na strony 3 głównych konkurentów i porównuję ceny. Zajmuje 2-3h. Rzadko coś z tego wynika — nie mam systemu śledzenia zmian cen"',
        required: false,
      },
      {
        id: 'data_5',
        question: 'Dashboard "zdrowie firmy" na telefonie — co chciałbyś widzieć rano wchodząc do pracy? Maksymalnie 5-7 wskaźników.',
        placeholder: 'Np. "1. Przychód dziś vs. cel tygodniowy 2. Top 5 produktów teraz 3. Co się kończy w magazynie 4. Ile zamówień czeka 5. Czy Marta i Karolina nadążają z obsługą"',
        required: false,
      },
    ],
  },
  {
    id: 'kontekst',
    label: 'Kontekst Strategiczny',
    description: 'Priorytety, pilność i kontekst decyzyjny — notatki konsultanta',
    consultantOnly: true,
    questions: [
      {
        id: 'strat_1',
        question: 'Co się stanie jeśli przez rok nic nie zmienicie? Jaki jest koszt bezczynności — utracone przychody, wypalenie zespołu, utrata pozycji rynkowej?',
        placeholder: 'Np. "Handlowcy odejdą z wypalenia (już mówią). Konkurencja z automatyzacją przejmie klientów B2B. Sezon jesienny 2026 znowu skończy się zaległościami i oversalami"',
        required: false,
      },
      {
        id: 'strat_2',
        question: 'Orientacyjny budżet na wdrożenia AI w 2026: jednorazowo i miesięcznie? Czy klient wspomniał liczby lub dał sygnały budżetowe podczas rozmowy?',
        placeholder: 'Np. "Nie powiedział wprost. Z rozmowy: wydaje ~3k/mies na narzędzia których nie używa, mówił o inwestycji która się zwróci. Szacuję: gotowość 20-40k setup, 2-4k/mies"',
        required: false,
      },
      {
        id: 'strat_3',
        question: 'Kto faktycznie podejmuje decyzję o wdrożeniu? Czy właściciel decyduje sam, czy potrzebuje akceptacji (wspólnik, CFO, inwestor)? Jaki jest typowy czas decyzji?',
        placeholder: 'Np. "Właściciel decyduje sam — szybko jak jest przekonany. Powiedział \"jeśli to ma sens, wdrażamy w ciągu miesiąca\". Żona też jest w firmie ale nie blokuje"',
        required: false,
      },
      {
        id: 'strat_4',
        question: 'Gdyby klient miał wdrożyć JEDNĄ rzecz w ciągu 30 dni — co by to było na podstawie Twojej rozmowy? Co sprawiało mu największy ból emocjonalny?',
        placeholder: 'Np. "Zdecydowanie Voice Agent — wspomniał utracone leady weekendowe 3 razy. To jego ból nr 1. ROI najszybszy i namacalny: telefon = klient = pieniądze. Łatwo uzasadnić"',
        required: false,
      },
    ],
  },
]

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export const QUESTION_BY_ID: Record<string, AuditQuestion> = {}
for (const cat of AUDIT_CATEGORIES) {
  for (const q of cat.questions) {
    QUESTION_BY_ID[q.id] = q
  }
}
