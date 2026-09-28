(() => {
  "use strict";

  const STORAGE_KEY = "cv-studio-state-v1";
  const DATA_VERSION = 2;
  const STEPS = ["Kierunek", "Podstawy", "Doświadczenie", "Osiągnięcia", "Kompetencje", "Finalizacja"];
  const SECTION_KEYS = ["summary", "experience", "skills", "education", "certificates", "languages", "consent"];
  const SECTION_LABELS = {
    pl: { summary: "Profil", experience: "Doświadczenie", skills: "Umiejętności", education: "Wykształcenie", certificates: "Certyfikaty", languages: "Języki", consent: "Klauzula" },
    en: { summary: "Profile", experience: "Experience", skills: "Skills", education: "Education", certificates: "Certificates", languages: "Languages", consent: "Consent" }
  };
  const STEP_TITLES = ["Wybierz kierunek", "Zbuduj mocny początek", "Pokaż kontekst pracy", "Zamień obowiązki w osiągnięcia", "Uporządkuj kompetencje", "Sprawdź i eksportuj"];

  const TRACKS = {
    operations: {
      label: "Supply chain i operacje",
      description: "Planowanie, raportowanie, procesy, projekty przemysłowe i analiza danych.",
      icon: "↗",
      roles: {
        pl: "Analityk operacyjny | Supply Chain",
        en: "Operations Analyst | Supply Chain"
      },
      skills: ["Excel", "Power Query", "Power BI", "VBA", "MS Project", "SharePoint", "Analiza KPI", "Planowanie"],
      prompts: [
        "Ile raportów przygotowujesz i jak często?",
        "Co zmieniło się po automatyzacji: czas, liczba kroków czy błędów?",
        "Ilu odbiorców korzysta z danych lub dokumentacji?",
        "Jaką decyzję wsparła Twoja analiza?"
      ]
    },
    finance: {
      label: "Finanse i księgowość",
      description: "Faktury, rozliczenia, faktoring, należności, kontrola i raportowanie.",
      icon: "Σ",
      roles: {
        pl: "Specjalista ds. finansów i rozliczeń",
        en: "Finance & Settlements Specialist"
      },
      skills: ["Excel", "ERP", "SAP", "Rozliczanie faktur", "Faktoring", "Należności", "Uzgadnianie sald", "Kontrola danych"],
      prompts: [
        "Ile faktur lub transakcji obsługujesz miesięcznie?",
        "Jaką wartość lub portfel obejmuje proces?",
        "Jak skrócił się czas rozliczenia albo zamknięcia miesiąca?",
        "Jak ograniczono błędy, opóźnienia lub przeterminowane należności?"
      ]
    }
  };

  const ACTIONS = {
    pl: ["Zautomatyzowałem", "Usprawniłem", "Przygotowywałem", "Monitorowałem", "Uzgadniałem", "Wdrożyłem", "Zoptymalizowałem"],
    en: ["Automated", "Improved", "Prepared", "Monitored", "Reconciled", "Implemented", "Optimised"]
  };

  const TEMPLATE_DEFS = [
    { id: "finance-ap", track: "finance", icon: "FV", title: "Finanse · AP/AR", role: "Specjalistka ds. księgowości AP/AR", roleEn: "Accounts Payable / Receivable Specialist", note: "Faktury, rozrachunki, cash application", theme: "graphite", layout: "single", ats: true },
    { id: "finance-r2r", track: "finance", icon: "R2R", title: "Finanse · R2R", role: "Financial Reporting & R2R Specialist", roleEn: "Financial Reporting & R2R Specialist", note: "Zamknięcie miesiąca, IFRS, kontrole", theme: "navy", layout: "grid", ats: false },
    { id: "supply-planner", track: "operations", icon: "SC", title: "Supply Chain Planner", role: "Supply Chain & Inventory Planner", roleEn: "Supply Chain & Inventory Planner", note: "Prognozy, OTIF, zapasy, SAP", theme: "teal", layout: "split", ats: false },
    { id: "procurement-data", track: "operations", icon: "BI", title: "Procurement & Data", role: "Junior Procurement Data Analyst", roleEn: "Junior Procurement Data Analyst", note: "Dostawcy, KPI, Excel, Power BI", theme: "cobalt", layout: "single", ats: true }
  ];

  const els = {};
  let state = loadState();
  let bulletDraft = { experienceIndex: 0, action: "", task: "", tool: "", scale: "", result: "" };
  let saveTimer;
  let toastTimer;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    Object.assign(els, {
      stepEyebrow: document.querySelector("#stepEyebrow"),
      stepTitle: document.querySelector("#stepTitle"),
      progressValue: document.querySelector("#progressValue"),
      progressBar: document.querySelector("#progressBar"),
      stepNav: document.querySelector("#stepNav"),
      stepContent: document.querySelector("#stepContent"),
      previousButton: document.querySelector("#previousButton"),
      nextButton: document.querySelector("#nextButton"),
      cvDocument: document.querySelector("#cvDocument"),
      scoreValue: document.querySelector("#scoreValue"),
      scoreRing: document.querySelector("#scoreRing"),
      scoreHint: document.querySelector("#scoreHint"),
      layoutChip: document.querySelector("#layoutChip"),
      saveState: document.querySelector("#saveState"),
      importDialog: document.querySelector("#importDialog"),
      importText: document.querySelector("#importText"),
      importFile: document.querySelector("#importFile"),
      toast: document.querySelector("#toast")
    });

    document.querySelector("#previousButton").addEventListener("click", () => goToStep(state.step - 1));
    document.querySelector("#nextButton").addEventListener("click", () => goToStep(state.step + 1));
    document.querySelector("#pdfButton").addEventListener("click", exportPdf);
    document.querySelector("#docxButton").addEventListener("click", exportDocx);
    document.querySelector("#importButton").addEventListener("click", () => els.importDialog.showModal());
    document.querySelector("#confirmImportButton").addEventListener("click", importContent);
    document.querySelector("#backupButton").addEventListener("click", downloadBackup);
    document.querySelector("#resetButton").addEventListener("click", resetCv);
    els.importFile.addEventListener("change", readImportFile);
    document.querySelectorAll("[data-lang]").forEach(button => button.addEventListener("click", () => switchLanguage(button.dataset.lang)));

    els.stepNav.addEventListener("click", event => {
      const button = event.target.closest("[data-step]");
      if (button) goToStep(Number(button.dataset.step));
    });
    els.stepContent.addEventListener("input", handleFormInput);
    els.stepContent.addEventListener("change", handleFormInput);
    els.stepContent.addEventListener("click", handleFormClick);
    els.cvDocument.addEventListener("focusout", handleInlineEdit);

    renderAll();
    registerWebMcpTools();
  }

  function blankDoc(lang, track = "operations") {
    return {
      identity: { name: "", targetRole: TRACKS[track].roles[lang], email: "", phone: "", city: "", linkedin: "", portfolio: "" },
      summary: "",
      experiences: [{ id: uid(), role: "", company: "", location: "", start: "", end: "", context: "", bullets: [] }],
      skills: { core: [], tools: [], domain: [] },
      education: { school: "", degree: "", date: "" },
      certificates: [],
      languages: [],
      consent: "",
      sectionOrder: [...SECTION_KEYS],
      sectionTitles: {},
      customSections: [],
      layout: { mode: "single", theme: "navy", placements: {} },
      templateId: null
    };
  }

  function defaultState() {
    return { version: DATA_VERSION, lang: "pl", track: "operations", step: 0, docs: { pl: blankDoc("pl"), en: blankDoc("en") } };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.docs?.pl && saved.docs?.en) {
        saved.docs.pl = normalizeDoc(saved.docs.pl, "pl", saved.track || "operations");
        saved.docs.en = normalizeDoc(saved.docs.en, "en", saved.track || "operations");
        saved.version = DATA_VERSION;
        return saved;
      }
    } catch (error) {
      console.warn("Nie udało się odczytać lokalnego zapisu", error);
    }
    return defaultState();
  }

  function normalizeDoc(doc, lang, track) {
    const base = blankDoc(lang, track);
    const normalized = { ...base, ...doc };
    normalized.identity = { ...base.identity, ...(doc.identity || {}) };
    normalized.skills = { ...base.skills, ...(doc.skills || {}) };
    normalized.education = { ...base.education, ...(doc.education || {}) };
    normalized.sectionTitles = doc.sectionTitles || {};
    normalized.customSections = Array.isArray(doc.customSections) ? doc.customSections : [];
    normalized.layout = { ...base.layout, ...(doc.layout || {}), placements: { ...(doc.layout?.placements || {}) } };
    const validKeys = new Set([...SECTION_KEYS, ...normalized.customSections.map(section => section.id)]);
    normalized.sectionOrder = [...new Set([...(doc.sectionOrder || SECTION_KEYS), ...SECTION_KEYS])].filter(key => validKeys.has(key));
    return normalized;
  }

  function createTemplateDoc(templateId, lang = "pl") {
    const meta = TEMPLATE_DEFS.find(template => template.id === templateId) || TEMPLATE_DEFS[0];
    const d = blankDoc(lang, meta.track);
    d.templateId = meta.id;
    d.layout = { mode: meta.layout, theme: meta.theme, placements: {} };
    d.identity = {
      name: "Anna Kowalska",
      targetRole: lang === "en" ? meta.roleEn : meta.role,
      email: "anna.kowalska@example.com",
      phone: "+48 500 000 000",
      city: "Katowice",
      linkedin: "linkedin.com/in/twoj-profil",
      portfolio: ""
    };
    d.education = { school: "Uniwersytet Ekonomiczny w Katowicach", degree: "Finanse i rachunkowość, licencjat", date: "2019 — 2022" };
    d.languages = ["Polski — ojczysty", "Angielski — B2/C1"];
    d.certificates = ["Excel — analiza danych i Power Query (kurs przykładowy)"];

    if (templateId === "finance-ap") {
      d.summary = "Specjalistka ds. księgowości z 3-letnim doświadczeniem w procesach AP/AR w środowisku usług wspólnych. Weryfikuje faktury, uzgadnia salda i wspiera zamknięcie miesiąca, wykorzystując SAP FI, Excel i Power Query. Dba o terminowość płatności, kompletność dokumentacji oraz sprawne wyjaśnianie rozbieżności z dostawcami.";
      d.experiences = [
        { id: uid(), role: "Specjalistka ds. księgowości AP/AR", company: "Nordica Services Sp. z o.o. — firma przykładowa", location: "Katowice / hybrydowo", start: "03.2023", end: "obecnie", context: "Centrum usług wspólnych obsługujące procesy finansowe dla spółek europejskich.", bullets: [
          "Weryfikowała i księgowała średnio 900 faktur miesięcznie w SAP FI, kontrolując poprawność danych, kodowanie kosztów i zgodność z zamówieniami.",
          "Uzgadniała salda 60 dostawców i wyjaśniała rozbieżności, ograniczając liczbę otwartych pozycji starszych niż 30 dni o 28%.",
          "Przygotowała kontrolę wyjątków w Excelu i Power Query, skracając cotygodniowy przegląd duplikatów z 2 godzin do 25 minut.",
          "Wspierała zamknięcie miesiąca poprzez uzgodnienia AP/AR, raport otwartych pozycji i kompletowanie dokumentacji audytowej."
        ]},
        { id: uid(), role: "Młodsza księgowa", company: "Silesia Trade Sp. z o.o. — firma przykładowa", location: "Katowice", start: "07.2021", end: "02.2023", context: "Zespół finansowy firmy handlowej.", bullets: [
          "Rejestrowała faktury kosztowe i monitorowała terminy płatności dla portfela około 120 aktywnych dostawców.",
          "Przygotowywała potwierdzenia sald i zestawienia należności dla księgi głównej oraz zespołu controllingu."
        ]}
      ];
      d.skills = { tools: ["SAP FI", "Excel — tabele przestawne, XLOOKUP", "Power Query", "MS Office"], core: ["Accounts Payable", "Accounts Receivable", "Cash application", "Uzgadnianie sald", "Zamknięcie miesiąca"], domain: ["Obieg faktur", "Kontrola dokumentów", "Rozrachunki z dostawcami", "Podstawy GL"] };
      d.sectionTitles = { summary: "O mnie", skills: "Kompetencje finansowe" };
    }

    if (templateId === "finance-r2r") {
      d.summary = "Analityczka finansowa z doświadczeniem w procesie Record-to-Report, raportowaniu zarządczym i kontroli jakości danych. Realizuje zamknięcie miesiąca, analizuje odchylenia P&L i bilansu oraz przygotowuje dokumentację dla audytu. Łączy znajomość SAP z automatyzacją raportów w Excelu i Power BI.";
      d.experiences = [{ id: uid(), role: "Financial Reporting & R2R Specialist", company: "Global Foods Hub — firma przykładowa", location: "Katowice / hybrydowo", start: "01.2023", end: "obecnie", context: "Międzynarodowe centrum finansowe odpowiedzialne za procesy R2R dla kilku rynków europejskich.", bullets: [
        "Realizowała zadania zamknięcia miesiąca dla 4 jednostek, przygotowując księgowania memoriałów, rezerw i reklasyfikacji w SAP.",
        "Analizowała odchylenia P&L i bilansu oraz przedstawiała wyjaśnienia podczas miesięcznych spotkań z interesariuszami finansowymi.",
        "Ustandaryzowała plik uzgodnień kont bilansowych w Excelu, skracając przygotowanie pakietu kontrolnego o 35%.",
        "Wspierała kontrole SOX oraz audyt wewnętrzny i zewnętrzny, zapewniając kompletność dokumentacji i terminowe zamknięcie działań."
      ]}];
      d.skills = { tools: ["SAP R/3", "Excel", "Power Query", "Power BI", "BlackLine — podstawy"], core: ["Record-to-Report", "Month-end close", "Journal entries", "Reconciliation", "Variance analysis"], domain: ["IFRS — podstawy", "SOX i kontrola wewnętrzna", "P&L i bilans", "Wsparcie audytu"] };
      d.sectionTitles = { summary: "Profil finansowy", experience: "Doświadczenie R2R" };
      d.layout.placements = { summary: "full", experience: "full", skills: "left", education: "right", certificates: "left", languages: "right" };
    }

    if (templateId === "supply-planner") {
      d.identity.targetRole = "Supply Chain & Inventory Planner";
      d.education = { school: "Politechnika Śląska", degree: "Logistyka, inżynier", date: "2018 — 2022" };
      d.summary = "Planistka supply chain z doświadczeniem w planowaniu zapasów, obsłudze zamówień i monitorowaniu realizacji dostaw. Pracuje na danych z SAP i Excela, analizuje OTIF, rotację oraz ryzyko braków, a wyniki prezentuje w Power BI. Współpracuje z produkcją, zakupami, magazynem i zespołami sprzedaży w środowisku międzynarodowym.";
      d.experiences = [{ id: uid(), role: "Supply Chain Planner", company: "Silesia Manufacturing — firma przykładowa", location: "Katowice", start: "05.2022", end: "obecnie", context: "Producent komponentów obsługujący klientów przemysłowych w Europie Środkowej.", bullets: [
        "Planowała zapasy dla portfela 180 indeksów materiałowych, bilansując dostępność produktów, poziom bezpieczeństwa i cele kapitału obrotowego.",
        "Monitorowała OTIF, rotację zapasów i pozycje SLOB, przygotowując cotygodniowe rekomendacje dla zakupów, produkcji i sprzedaży.",
        "Zbudowała dashboard Power BI łączący dane z SAP i 3 plików operacyjnych, skracając przygotowanie przeglądu KPI z 4 godzin do 45 minut.",
        "Koordynowała działania korygujące przy ryzyku stock-out, utrzymując terminowość dostaw powyżej 96% w przypisanej grupie produktów."
      ]}];
      d.skills = { tools: ["SAP", "Excel — Power Query", "Power BI", "MS Office"], core: ["Supply planning", "Inventory management", "Demand forecasting", "Order management", "Analiza KPI"], domain: ["OTIF", "SLOB", "Inventory turnover", "S&OP / IBP", "Master data"] };
      d.certificates = ["APICS Basics of Supply Chain — kurs przykładowy", "Power BI — modelowanie i wizualizacja danych"];
      d.sectionTitles = { summary: "Podsumowanie", skills: "Supply chain toolkit" };
      d.layout.placements = { summary: "full", experience: "right", skills: "left", education: "left", certificates: "left", languages: "left" };
    }

    if (templateId === "procurement-data") {
      d.identity.targetRole = "Junior Procurement Data Analyst";
      d.education = { school: "Uniwersytet Ekonomiczny w Katowicach", degree: "Logistyka w biznesie, magister", date: "2021 — 2023" };
      d.summary = "Analityczka procurement i logistyki, która wspiera decyzje zakupowe przez porządkowanie danych, monitoring dostawców i przejrzyste raportowanie. Tworzy analizy w Excelu i Power BI, kontroluje jakość danych oraz dokumentuje usprawnienia procesów. Swobodnie współpracuje po angielsku z zespołami i dostawcami z różnych krajów.";
      d.experiences = [{ id: uid(), role: "Junior Procurement Data Analyst", company: "Europe Logistics Hub — firma przykładowa", location: "Katowice / hybrydowo", start: "09.2023", end: "obecnie", context: "Europejski zespół procurement i logistyki wspierający przetargi oraz ocenę dostawców.", bullets: [
        "Zbierała i walidowała dane z 8 rynków do analiz usług logistycznych, przetargów i okresowych przeglądów wydajności dostawców.",
        "Opracowała dashboard Power BI monitorujący terminowość, koszty i jakość obsługi 35 dostawców, używany podczas miesięcznych przeglądów.",
        "Zautomatyzowała konsolidację plików ofertowych w Power Query, redukując liczbę ręcznych kroków z 14 do 4.",
        "Przygotowywała benchmarki oraz materiały dla interesariuszy, wskazując różnice cenowe, ryzyka i możliwości usprawnienia procesu."
      ]}];
      d.skills = { tools: ["Excel", "Power Query", "Power BI", "SharePoint", "SAP — podstawy"], core: ["Analiza danych zakupowych", "Supplier performance", "Benchmarking", "Raportowanie KPI", "Walidacja danych"], domain: ["Procurement", "Logistyka", "Proces przetargowy", "Stakeholder management"] };
      d.certificates = ["Google Data Analytics", "Power BI — podstawy DAX"];
      d.sectionTitles = { summary: "O mnie", skills: "Narzędzia i kompetencje" };
    }
    return normalizeDoc(d, lang, meta.track);
  }

  function currentDoc() { return state.docs[state.lang]; }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function h(value = "") { return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); }
  function filenamePart(value) { return (value || "CV").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, ""); }

  function scheduleSave() {
    clearTimeout(saveTimer);
    els.saveState?.classList.add("is-saving");
    if (els.saveState) els.saveState.lastChild.textContent = " Zapisywanie…";
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      els.saveState?.classList.remove("is-saving");
      if (els.saveState) els.saveState.lastChild.textContent = " Zapisano lokalnie";
    }, 220);
  }

  function renderAll() {
    document.documentElement.lang = state.lang;
    renderHeader();
    renderStepNav();
    renderStep();
    renderPreview();
    updateScore();
    scheduleSave();
  }

  function renderHeader() {
    document.querySelectorAll("[data-lang]").forEach(button => {
      const active = button.dataset.lang === state.lang;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    els.stepEyebrow.textContent = `Etap ${state.step + 1} z ${STEPS.length}`;
    els.stepTitle.textContent = STEP_TITLES[state.step];
    const progress = Math.round(((state.step + 1) / STEPS.length) * 100);
    els.progressValue.textContent = `${progress}%`;
    els.progressBar.style.width = `${progress}%`;
    els.previousButton.disabled = state.step === 0;
    els.previousButton.style.visibility = state.step === 0 ? "hidden" : "visible";
    els.nextButton.textContent = state.step === STEPS.length - 1 ? "Gotowe" : "Dalej";
    if (els.layoutChip) els.layoutChip.textContent = `A4 · ${{ single: "1 kolumna", split: "wąska + szeroka", grid: "siatka" }[currentDoc().layout.mode]}`;
  }

  function renderStepNav() {
    els.stepNav.innerHTML = STEPS.map((label, index) => {
      const className = index === state.step ? "is-current" : index < state.step ? "is-complete" : "";
      return `<button class="step-button ${className}" type="button" data-step="${index}" aria-label="${h(label)}" title="${h(label)}">${index < state.step ? "✓" : index + 1}</button>`;
    }).join("");
  }

  function renderStep() {
    const renderers = [renderTrackStep, renderBasicsStep, renderExperienceStep, renderAchievementsStep, renderSkillsStep, renderReviewStep];
    els.stepContent.innerHTML = renderers[state.step]();
    if (state.step === 5) bindLayoutBoard();
  }

  function renderTrackStep() {
    const doc = currentDoc();
    return `
      <p class="step-intro">Zacznij od gotowego przykładu Anny Kowalskiej albo wybierz kierunek i zbuduj CV od zera. Każdy element szablonu pozostaje edytowalny.</p>
      <div class="section-label"><div><h2>Gotowe CV do edycji</h2><p>Dane, firmy i wyniki są hipotetyczne — zamień je na własne fakty.</p></div></div>
      <div class="template-grid">
        ${TEMPLATE_DEFS.map(template => `
          <button class="template-card ${doc.templateId === template.id ? "is-selected" : ""}" type="button" data-action="apply-template" data-template="${template.id}">
            <span class="template-icon template-${template.theme}">${template.icon}</span>
            <span class="template-copy"><strong>${h(template.title)}</strong><span>${h(template.role)}</span><small>${h(template.note)}</small></span>
            <span class="template-badge ${template.ats ? "is-ats" : ""}">${template.ats ? "ATS" : "layout"}</span>
          </button>`).join("")}
      </div>
      <div class="section-label"><div><h2>Lub wybierz kierunek od zera</h2><p>Pytania i podpowiedzi dopasują się do rodzaju pracy.</p></div></div>
      <div class="choice-grid">
        ${Object.entries(TRACKS).map(([key, track]) => `
          <label class="choice-card ${state.track === key ? "is-selected" : ""}">
            <input type="radio" name="track" value="${key}" ${state.track === key ? "checked" : ""} />
            <span class="choice-icon">${track.icon}</span>
            <span><strong>${track.label}</strong><span>${track.description}</span></span>
            <span class="choice-check">${state.track === key ? "Wybrano" : ""}</span>
          </label>`).join("")}
      </div>
      <div class="section-label"><div><h2>Docelowa rola</h2><p>Nazwa widoczna bezpośrednio pod imieniem.</p></div></div>
      <label class="field"><span>Tytuł zawodowy</span><input data-path="identity.targetRole" value="${h(doc.identity.targetRole)}" placeholder="np. Analityk operacyjny | Power BI" /></label>
      <div class="suggestion-box"><strong>Ważna zasada</strong><p>Dodawaj tylko narzędzia i obowiązki, które potrafisz obronić konkretnym przykładem.</p></div>`;
  }

  function renderBasicsStep() {
    const d = currentDoc();
    return `
      <p class="step-intro">Nagłówek ma w kilka sekund powiedzieć rekruterowi, kim jesteś, czego szukasz i jak się z Tobą skontaktować.</p>
      <div class="form-grid">
        ${field("Imię i nazwisko", "identity.name", d.identity.name, "np. Anna Nowak", true)}
        ${field("Miasto", "identity.city", d.identity.city, "np. Katowice")}
        ${field("E-mail", "identity.email", d.identity.email, "anna.nowak@email.com")}
        ${field("Telefon", "identity.phone", d.identity.phone, "+48 000 000 000")}
        ${field("LinkedIn", "identity.linkedin", d.identity.linkedin, "linkedin.com/in/…")}
        ${field("Portfolio / GitHub", "identity.portfolio", d.identity.portfolio, "github.com/…")}
        <label class="field field-wide"><span>Profil zawodowy — maksymalnie 3–4 linie</span><textarea data-path="summary" rows="5" placeholder="Specjalizacja + doświadczenie + narzędzia + typ problemów, które rozwiązujesz.">${h(d.summary)}</textarea><small>Unikaj słów „zmotywowany”, „ambitny” i „pasjonat”, jeśli nie prowadzą do konkretu.</small></label>
      </div>`;
  }

  function renderExperienceStep() {
    const d = currentDoc();
    return `
      <p class="step-intro">Najpierw opisz środowisko pracy. W kolejnym etapie zbudujesz krótkie punkty pokazujące skalę i rezultat.</p>
      <div class="section-label"><div><h2>Stanowiska</h2><p>Najbardziej aktualne umieść jako pierwsze.</p></div><button class="button button-small button-secondary" type="button" data-action="add-experience">+ Dodaj</button></div>
      ${d.experiences.map((exp, index) => `
        <section class="entry-card">
          <div class="entry-card-head"><strong>Pozycja ${index + 1}</strong>${d.experiences.length > 1 ? `<button class="text-button" type="button" data-action="remove-experience" data-index="${index}">Usuń</button>` : ""}</div>
          <div class="form-grid">
            ${expField("Stanowisko", index, "role", exp.role, "np. Junior Data Analyst")}
            ${expField("Firma", index, "company", exp.company, "Nazwa firmy")}
            ${expField("Od", index, "start", exp.start, "MM.RRRR")}
            ${expField("Do", index, "end", exp.end, "obecnie")}
            ${expField("Lokalizacja", index, "location", exp.location, "Miasto / zdalnie")}
            <label class="field field-wide"><span>Kontekst firmy lub projektu</span><textarea rows="2" data-exp-index="${index}" data-exp-field="context" placeholder="np. Generalny wykonawca projektu przemysłowego…">${h(exp.context)}</textarea></label>
            <label class="field field-wide"><span>Punkty doświadczenia — jeden w wierszu</span><textarea rows="5" data-exp-index="${index}" data-exp-field="bullets" placeholder="Każdy punkt zacznij czasownikiem…">${h(exp.bullets.join("\n"))}</textarea></label>
          </div>
        </section>`).join("")}`;
  }

  function renderAchievementsStep() {
    const d = currentDoc();
    const track = TRACKS[state.track];
    const draft = buildBullet();
    return `
      <p class="step-intro">Dobra linia CV łączy działanie, zadanie, narzędzie, skalę i efekt. Uzupełnij tylko pola, które znasz — nie wymyślaj liczb.</p>
      <div class="suggestion-box"><strong>Pytania pomocnicze</strong><p>${track.prompts.map(h).join(" · ")}</p></div>
      <div class="form-grid">
        <label class="field field-wide"><span>Dodaj punkt do stanowiska</span><select data-draft="experienceIndex">${d.experiences.map((exp, i) => `<option value="${i}" ${Number(bulletDraft.experienceIndex) === i ? "selected" : ""}>${h(exp.role || `Pozycja ${i + 1}`)} — ${h(exp.company || "firma")}</option>`)}</select></label>
        <label class="field"><span>Czasownik działania</span><select data-draft="action"><option value="">Wybierz…</option>${ACTIONS[state.lang].map(action => `<option ${bulletDraft.action === action ? "selected" : ""}>${action}</option>`)}</select></label>
        <label class="field"><span>Zadanie / proces</span><input data-draft="task" value="${h(bulletDraft.task)}" placeholder="np. cykliczne raportowanie" /></label>
        <label class="field"><span>Narzędzie</span><input data-draft="tool" value="${h(bulletDraft.tool)}" placeholder="np. Power Query i VBA" /></label>
        <label class="field"><span>Skala</span><input data-draft="scale" value="${h(bulletDraft.scale)}" placeholder="np. 4 źródła, 12 odbiorców" /></label>
        <label class="field field-wide"><span>Rezultat biznesowy</span><input data-draft="result" value="${h(bulletDraft.result)}" placeholder="np. skracając przygotowanie raportu z 3 godzin do 20 minut" /></label>
      </div>
      <div class="bullet-preview ${draft ? "" : "is-empty"}" id="bulletPreview">${h(draft || "Tutaj pojawi się gotowy punkt.")}</div>
      <div class="section-label"><button class="button button-primary" type="button" data-action="add-bullet">Dodaj do CV</button></div>`;
  }

  function renderSkillsStep() {
    const d = currentDoc();
    const track = TRACKS[state.track];
    return `
      <p class="step-intro">Grupuj kompetencje, aby można było je szybko przeskanować. Sugestie są tylko podpowiedzią — kliknij wyłącznie te, które rzeczywiście znasz.</p>
      <div class="form-grid">
        ${listField("Narzędzia i technologie", "skills.tools", d.skills.tools, "Excel, Power BI, SAP")}
        ${listField("Kompetencje główne", "skills.core", d.skills.core, "Analiza danych, raportowanie")}
        ${listField("Wiedza domenowa", "skills.domain", d.skills.domain, "Supply chain, faktoring")}
        <div class="field field-wide"><span>Podpowiedzi dla wybranego kierunku</span><div class="chip-input">${track.skills.map(skill => `<button class="skill-chip" type="button" data-action="suggest-skill" data-skill="${h(skill)}">+ ${h(skill)}</button>`).join("")}</div></div>
      </div>
      <div class="section-label"><div><h2>Wykształcenie i pozostałe informacje</h2></div></div>
      <div class="form-grid">
        ${field("Szkoła / uczelnia", "education.school", d.education.school, "Nazwa uczelni", true)}
        ${field("Kierunek / tytuł", "education.degree", d.education.degree, "Kierunek i poziom")}
        ${field("Okres", "education.date", d.education.date, "2020–2024")}
        ${listField("Certyfikaty", "certificates", d.certificates, "Google Data Analytics, PL-300")}
        ${listField("Języki", "languages", d.languages, "Polski — ojczysty, Angielski — C1")}
        <label class="field field-wide"><span>Klauzula — tylko jeśli wymagana</span><textarea data-path="consent" rows="3" placeholder="Wklej dokładną treść wymaganą przez pracodawcę.">${h(d.consent)}</textarea></label>
      </div>`;
  }

  function renderReviewStep() {
    const quality = qualityChecks();
    const d = currentDoc();
    const entries = d.sectionOrder.map(key => sectionDescriptor(key)).filter(Boolean);
    return `
      <p class="step-intro">Dopasuj układ jak planszę: sekcja może zajmować całą szerokość albo lewą lub prawą kolumnę. Nagłówki są edytowalne tutaj i bezpośrednio na dokumencie.</p>
      <div class="section-label"><div><h2>Kontrola jakości</h2><p>${quality.filter(item => item.ok).length} z ${quality.length} kryteriów spełnionych</p></div></div>
      <ul class="quality-list">${quality.map(item => `<li class="quality-item ${item.ok ? "is-good" : ""}"><span class="quality-icon">${item.ok ? "✓" : "!"}</span><span>${h(item.label)}</span></li>`).join("")}</ul>
      <div class="section-label"><div><h2>Globalny układ dokumentu</h2><p>Jedna kolumna jest najbezpieczniejsza dla ATS; pozostałe sprawdzają się w wersji wysyłanej bezpośrednio.</p></div></div>
      <div class="layout-choice-grid">
        ${layoutChoice("single", "Jedna kolumna", "Najwyższa zgodność ATS", "▤")}
        ${layoutChoice("split", "Wąska + szeroka", "Panel boczny i główna treść", "▥")}
        ${layoutChoice("grid", "Siatka modułowa", "Równe prostokątne moduły", "▦")}
      </div>
      <div class="section-label"><div><h2>Styl dokumentu</h2><p>Zmienia akcent i charakter, nie treść.</p></div></div>
      <div class="theme-picker" role="group" aria-label="Styl dokumentu">
        ${[["navy","Granat"],["graphite","Grafit"],["teal","Zieleń"],["cobalt","Kobalt"]].map(([key,label]) => `<button class="theme-swatch theme-${key} ${d.layout.theme === key ? "is-active" : ""}" type="button" data-action="set-theme" data-theme="${key}" aria-pressed="${d.layout.theme === key}"><span></span>${label}</button>`).join("")}
      </div>
      <div class="section-label"><div><h2>Sekcje i ich położenie</h2><p>Zmień nazwę, ustaw szerokość i kolejność. Możesz też przeciągać moduły poniżej.</p></div><button class="button button-small button-secondary" type="button" data-action="add-custom-section">+ Własna sekcja</button></div>
      <div class="layout-board ${d.layout.mode === "single" ? "is-single" : ""}" id="layoutBoard">
        ${entries.map((entry, index) => layoutSectionCard(entry, index, entries.length)).join("")}
      </div>
      <div class="suggestion-box"><strong>Przed wysłaniem</strong><p>Wyeksportuj PDF, skopiuj z niego tekst do Notatnika i sprawdź kolejność. Nazwij plik imieniem, nazwiskiem oraz docelową rolą.</p></div>`;
  }

  function layoutChoice(mode, title, note, icon) {
    const selected = currentDoc().layout.mode === mode;
    return `<button class="layout-choice ${selected ? "is-selected" : ""}" type="button" data-action="set-layout" data-layout="${mode}" aria-pressed="${selected}"><span class="layout-icon">${icon}</span><span><strong>${title}</strong><small>${note}</small></span></button>`;
  }

  function sectionDescriptor(key) {
    const d = currentDoc();
    const custom = d.customSections.find(section => section.id === key);
    if (custom) return { key, title: custom.title, custom };
    if (!SECTION_KEYS.includes(key)) return null;
    return { key, title: d.sectionTitles[key] || SECTION_LABELS[state.lang][key], custom: null };
  }

  function layoutSectionCard(entry, index, length) {
    const d = currentDoc();
    const placement = d.layout.mode === "single" ? "full" : (d.layout.placements[entry.key] || "full");
    return `<section class="layout-module placement-${placement}" draggable="true" data-layout-key="${entry.key}">
      <div class="layout-module-head"><span class="drag-grip" aria-hidden="true">⠿</span><input data-section-title-input="${entry.key}" value="${h(entry.title)}" aria-label="Nazwa sekcji ${h(entry.title)}" />${entry.custom ? `<button class="text-button" type="button" data-action="remove-custom-section" data-key="${entry.key}">Usuń</button>` : ""}</div>
      ${entry.custom ? `<textarea data-custom-content="${entry.key}" rows="3" aria-label="Treść sekcji ${h(entry.title)}" placeholder="Każdy punkt w osobnym wierszu">${h(entry.custom.content)}</textarea>` : ""}
      <div class="layout-module-controls">
        <label><span>Położenie</span><select data-section-placement="${entry.key}" ${d.layout.mode === "single" ? "disabled" : ""}><option value="full" ${placement === "full" ? "selected" : ""}>Cała szerokość</option><option value="left" ${placement === "left" ? "selected" : ""}>Lewa kolumna</option><option value="right" ${placement === "right" ? "selected" : ""}>Prawa kolumna</option></select></label>
        <span class="reorder-actions"><button class="move-button" type="button" data-action="move-section" data-key="${entry.key}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="Przenieś wcześniej">←</button><button class="move-button" type="button" data-action="move-section" data-key="${entry.key}" data-direction="1" ${index === length - 1 ? "disabled" : ""} aria-label="Przenieś dalej">→</button></span>
      </div>
    </section>`;
  }

  function field(label, path, value, placeholder, wide = false) {
    return `<label class="field ${wide ? "field-wide" : ""}"><span>${h(label)}</span><input data-path="${path}" value="${h(value)}" placeholder="${h(placeholder)}" /></label>`;
  }
  function expField(label, index, key, value, placeholder) {
    return `<label class="field"><span>${h(label)}</span><input data-exp-index="${index}" data-exp-field="${key}" value="${h(value)}" placeholder="${h(placeholder)}" /></label>`;
  }
  function listField(label, path, values, placeholder) {
    return `<label class="field field-wide"><span>${h(label)}</span><input data-list-path="${path}" value="${h(values.join(", "))}" placeholder="${h(placeholder)}" /><small>Oddziel elementy przecinkami.</small></label>`;
  }

  function handleFormInput(event) {
    const target = event.target;
    if (target.name === "track") {
      const oldTrack = state.track;
      state.track = target.value;
      const doc = currentDoc();
      const oldDefaults = [TRACKS[oldTrack].roles.pl, TRACKS[oldTrack].roles.en];
      if (!doc.identity.targetRole || oldDefaults.includes(doc.identity.targetRole)) doc.identity.targetRole = TRACKS[state.track].roles[state.lang];
      renderAll();
      return;
    }
    if (target.dataset.path) setPath(currentDoc(), target.dataset.path, target.value);
    if (target.dataset.listPath) setPath(currentDoc(), target.dataset.listPath, splitList(target.value));
    if (target.dataset.expField) {
      const exp = currentDoc().experiences[Number(target.dataset.expIndex)];
      exp[target.dataset.expField] = target.dataset.expField === "bullets" ? target.value.split(/\n/).map(value => value.trim()).filter(Boolean) : target.value;
    }
    if (target.dataset.sectionTitleInput) setSectionTitle(target.dataset.sectionTitleInput, target.value);
    if (target.dataset.customContent) {
      const section = currentDoc().customSections.find(item => item.id === target.dataset.customContent);
      if (section) section.content = target.value;
    }
    if (target.dataset.sectionPlacement) currentDoc().layout.placements[target.dataset.sectionPlacement] = target.value;
    if (target.dataset.draft) {
      bulletDraft[target.dataset.draft] = target.dataset.draft === "experienceIndex" ? Number(target.value) : target.value;
      const preview = document.querySelector("#bulletPreview");
      const text = buildBullet();
      if (preview) { preview.textContent = text || "Tutaj pojawi się gotowy punkt."; preview.classList.toggle("is-empty", !text); }
      return;
    }
    renderPreview();
    updateScore();
    scheduleSave();
  }

  function handleFormClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const d = currentDoc();
    const action = button.dataset.action;
    if (action === "add-experience") {
      d.experiences.push({ id: uid(), role: "", company: "", location: "", start: "", end: "", context: "", bullets: [] });
      renderAll();
    }
    if (action === "remove-experience") {
      d.experiences.splice(Number(button.dataset.index), 1);
      bulletDraft.experienceIndex = 0;
      renderAll();
    }
    if (action === "add-bullet") {
      const bullet = buildBullet();
      if (!bulletDraft.action || !bulletDraft.task || (!bulletDraft.scale && !bulletDraft.result)) {
        showToast("Dodaj czasownik, zadanie oraz skalę lub rezultat.");
        return;
      }
      d.experiences[Number(bulletDraft.experienceIndex)]?.bullets.push(bullet);
      bulletDraft = { experienceIndex: Number(bulletDraft.experienceIndex), action: "", task: "", tool: "", scale: "", result: "" };
      showToast("Punkt został dodany do doświadczenia.");
      renderAll();
    }
    if (action === "suggest-skill") {
      if (![...d.skills.core, ...d.skills.tools, ...d.skills.domain].includes(button.dataset.skill)) d.skills.tools.push(button.dataset.skill);
      showToast(`Dodano: ${button.dataset.skill}`);
      renderAll();
    }
    if (action === "move-section") {
      moveSection(button.dataset.key, Number(button.dataset.direction));
      renderAll();
    }
    if (action === "apply-template") applyTemplate(button.dataset.template);
    if (action === "set-layout") {
      d.layout.mode = button.dataset.layout;
      renderAll();
    }
    if (action === "set-theme") {
      d.layout.theme = button.dataset.theme;
      renderAll();
    }
    if (action === "add-custom-section") {
      const id = `custom-${uid()}`;
      d.customSections.push({ id, title: "Moja sekcja", content: "" });
      d.sectionOrder.push(id);
      d.layout.placements[id] = d.layout.mode === "single" ? "full" : "left";
      renderAll();
      showToast("Dodano własną sekcję — nadaj jej nazwę i treść.");
    }
    if (action === "remove-custom-section") {
      const key = button.dataset.key;
      d.customSections = d.customSections.filter(section => section.id !== key);
      d.sectionOrder = d.sectionOrder.filter(item => item !== key);
      delete d.layout.placements[key];
      renderAll();
    }
  }

  function applyTemplate(templateId) {
    const template = TEMPLATE_DEFS.find(item => item.id === templateId);
    if (!template) return;
    const existing = currentDoc();
    const hasOwnData = existing.identity.name || existing.identity.email || existing.summary || existing.experiences.some(exp => exp.role || exp.company || exp.bullets.length) || Object.values(existing.skills).some(values => values.length) || existing.customSections.length;
    if (hasOwnData && !window.confirm("Wczytanie szablonu zastąpi bieżącą treść tej wersji językowej. Kontynuować?")) return;
    state.track = template.track;
    state.docs[state.lang] = createTemplateDoc(templateId, state.lang);
    bulletDraft = { experienceIndex: 0, action: "", task: "", tool: "", scale: "", result: "" };
    renderAll();
    showToast(`Wczytano szablon: ${template.title}. Wszystkie pola możesz edytować.`);
  }

  function setSectionTitle(key, value) {
    const d = currentDoc();
    const custom = d.customSections.find(section => section.id === key);
    if (custom) custom.title = value;
    else d.sectionTitles[key] = value;
  }

  function bindLayoutBoard() {
    const board = document.querySelector("#layoutBoard");
    if (!board) return;
    let draggedKey = null;
    board.querySelectorAll("[data-layout-key]").forEach(card => {
      card.addEventListener("dragstart", event => {
        if (event.target.matches("input, textarea, select, button")) { event.preventDefault(); return; }
        draggedKey = card.dataset.layoutKey;
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
      card.addEventListener("dragover", event => event.preventDefault());
      card.addEventListener("drop", event => {
        event.preventDefault();
        const targetKey = card.dataset.layoutKey;
        if (!draggedKey || draggedKey === targetKey) return;
        const order = currentDoc().sectionOrder;
        const from = order.indexOf(draggedKey);
        const to = order.indexOf(targetKey);
        order.splice(to, 0, order.splice(from, 1)[0]);
        renderAll();
      });
    });
  }

  function buildBullet() {
    const b = bulletDraft;
    if (!b.action && !b.task) return "";
    if (state.lang === "en") {
      return [b.action, b.task, b.tool ? `using ${b.tool}` : "", b.scale ? `across ${b.scale}` : "", b.result ? `resulting in ${lowerFirst(b.result)}` : ""].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().replace(/\.?$/, ".");
    }
    return [b.action, b.task, b.tool ? `wykorzystując ${b.tool}` : "", b.scale ? `w skali ${b.scale}` : "", b.result ? `— ${lowerFirst(b.result)}` : ""].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().replace(/\.?$/, ".");
  }
  function lowerFirst(value) { return value ? value.charAt(0).toLowerCase() + value.slice(1) : value; }
  function splitList(value) { return value.split(",").map(item => item.trim()).filter(Boolean); }

  function renderPreview() {
    const d = currentDoc();
    const labels = SECTION_LABELS[state.lang];
    const contact = [d.identity.email, d.identity.phone, d.identity.city, d.identity.linkedin, d.identity.portfolio].filter(Boolean);
    const sections = {
      summary: sectionHtml("summary", d.sectionTitles.summary || labels.summary, `<p class="cv-summary ${d.summary ? "" : "cv-empty"}" contenteditable="true" data-inline="summary">${h(d.summary || (state.lang === "pl" ? "Dodaj krótki profil zawodowy: specjalizacja, doświadczenie, narzędzia i rodzaj rozwiązywanych problemów." : "Add a concise profile: specialisation, experience, tools and the problems you solve."))}</p>`),
      experience: sectionHtml("experience", d.sectionTitles.experience || labels.experience, d.experiences.map((exp, index) => experienceHtml(exp, index)).join("")),
      skills: sectionHtml("skills", d.sectionTitles.skills || labels.skills, skillsHtml(d.skills)),
      education: sectionHtml("education", d.sectionTitles.education || labels.education, educationHtml(d.education)),
      certificates: d.certificates.length ? sectionHtml("certificates", d.sectionTitles.certificates || labels.certificates, `<div class="cv-compact">${d.certificates.map((item, index) => `<div contenteditable="true" data-list-inline="certificates" data-index="${index}">${h(item)}</div>`).join("")}</div>`) : "",
      languages: d.languages.length ? sectionHtml("languages", d.sectionTitles.languages || labels.languages, `<div class="cv-compact">${d.languages.map((item, index) => `<div contenteditable="true" data-list-inline="languages" data-index="${index}">${h(item)}</div>`).join("")}</div>`) : "",
      consent: d.consent ? sectionHtml("consent", d.sectionTitles.consent || labels.consent, `<p class="cv-summary" contenteditable="true" data-inline="consent">${h(d.consent)}</p>`) : ""
    };
    d.customSections.forEach(custom => {
      const lines = custom.content.split(/\n/).map(line => line.trim()).filter(Boolean);
      const content = lines.length ? `<ul class="cv-bullets custom-bullets">${lines.map(line => `<li>${h(line)}</li>`).join("")}</ul>` : `<p class="cv-empty">${state.lang === "pl" ? "Uzupełnij własną sekcję w panelu układu." : "Complete your custom section in the layout panel."}</p>`;
      sections[custom.id] = sectionHtml(custom.id, custom.title || "Moja sekcja", content);
    });
    els.cvDocument.dataset.theme = d.layout.theme;
    els.cvDocument.dataset.layout = d.layout.mode;
    els.cvDocument.innerHTML = `
      <header class="cv-header">
        <h2 class="cv-name ${d.identity.name ? "" : "cv-empty"}" contenteditable="true" data-inline="identity.name">${h(d.identity.name || (state.lang === "pl" ? "Imię i nazwisko" : "Full name"))}</h2>
        <p class="cv-role" contenteditable="true" data-inline="identity.targetRole">${h(d.identity.targetRole)}</p>
        <div class="cv-contact">${contact.length ? contact.map(item => `<span>${h(item)}</span>`).join("") : `<span class="cv-empty">${state.lang === "pl" ? "e-mail · telefon · miasto · LinkedIn · portfolio" : "email · phone · city · LinkedIn · portfolio"}</span>`}</div>
      </header>
      <div class="cv-body cv-layout-${d.layout.mode}">${d.sectionOrder.map(key => sections[key] || "").join("")}</div>`;
    bindDragAndDrop();
  }

  function sectionHtml(key, label, content) {
    const placement = currentDoc().layout.mode === "single" ? "full" : (currentDoc().layout.placements[key] || "full");
    return `<section class="cv-section placement-${placement}" draggable="true" data-section="${key}"><h2 class="cv-section-title" contenteditable="true" data-section-title="${key}">${h(label)}</h2>${content}</section>`;
  }
  function experienceHtml(exp, index) {
    const date = [exp.start, exp.end].filter(Boolean).join(" — ");
    return `<div class="cv-entry">
      <div class="cv-entry-top"><div><h3 contenteditable="true" data-exp-inline="role" data-exp-index="${index}">${h(exp.role || (state.lang === "pl" ? "Stanowisko" : "Position"))}</h3><p class="cv-company" contenteditable="true" data-exp-inline="company" data-exp-index="${index}">${h([exp.company, exp.location].filter(Boolean).join(" · ") || (state.lang === "pl" ? "Firma · lokalizacja" : "Company · location"))}</p></div><span class="cv-date">${h(date || "MM.RRRR — MM.RRRR")}</span></div>
      ${exp.context ? `<p class="cv-context" contenteditable="true" data-exp-inline="context" data-exp-index="${index}">${h(exp.context)}</p>` : ""}
      ${exp.bullets.length ? `<ul class="cv-bullets">${exp.bullets.map((bullet, bulletIndex) => `<li contenteditable="true" data-bullet-exp="${index}" data-bullet-index="${bulletIndex}">${h(bullet)}</li>`).join("")}</ul>` : `<p class="cv-context cv-empty">${state.lang === "pl" ? "Dodaj 3–5 punktów opartych na rezultatach." : "Add 3–5 result-led bullet points."}</p>`}
    </div>`;
  }
  function skillsHtml(skills) {
    const groups = state.lang === "pl" ? [["Narzędzia", skills.tools], ["Kluczowe", skills.core], ["Domenowe", skills.domain]] : [["Tools", skills.tools], ["Core", skills.core], ["Domain", skills.domain]];
    const rows = groups.filter(([, values]) => values.length).map(([label, values]) => `<div class="cv-skill-row"><strong>${label}</strong><span>${h(values.join(" · "))}</span></div>`).join("");
    return `<div class="cv-skills">${rows || `<span class="cv-empty">${state.lang === "pl" ? "Dodaj pogrupowane umiejętności." : "Add grouped skills."}</span>`}</div>`;
  }
  function educationHtml(education) {
    const empty = !education.school && !education.degree;
    return `<div class="cv-compact-row ${empty ? "cv-empty" : ""}"><div><strong contenteditable="true" data-inline="education.degree">${h(education.degree || (state.lang === "pl" ? "Kierunek i poziom" : "Degree and field"))}</strong><div contenteditable="true" data-inline="education.school">${h(education.school || (state.lang === "pl" ? "Uczelnia" : "University"))}</div></div><span contenteditable="true" data-inline="education.date">${h(education.date || "RRRR — RRRR")}</span></div>`;
  }

  function bindDragAndDrop() {
    let draggedKey = null;
    els.cvDocument.querySelectorAll("[data-section]").forEach(section => {
      section.addEventListener("dragstart", () => { draggedKey = section.dataset.section; section.classList.add("is-dragging"); });
      section.addEventListener("dragend", () => { draggedKey = null; section.classList.remove("is-dragging"); });
      section.addEventListener("dragover", event => event.preventDefault());
      section.addEventListener("drop", event => {
        event.preventDefault();
        const targetKey = section.dataset.section;
        if (!draggedKey || draggedKey === targetKey) return;
        const order = currentDoc().sectionOrder;
        const from = order.indexOf(draggedKey);
        const to = order.indexOf(targetKey);
        order.splice(to, 0, order.splice(from, 1)[0]);
        renderAll();
      });
    });
  }

  function handleInlineEdit(event) {
    const target = event.target.closest("[contenteditable='true']");
    if (!target) return;
    const text = target.innerText.trim();
    const d = currentDoc();
    if (target.dataset.inline) setPath(d, target.dataset.inline, text);
    if (target.dataset.sectionTitle) setSectionTitle(target.dataset.sectionTitle, text);
    if (target.dataset.expInline) {
      const exp = d.experiences[Number(target.dataset.expIndex)];
      if (target.dataset.expInline === "company") exp.company = text.split("·")[0].trim();
      else exp[target.dataset.expInline] = text;
    }
    if (target.dataset.bulletExp) d.experiences[Number(target.dataset.bulletExp)].bullets[Number(target.dataset.bulletIndex)] = text;
    if (target.dataset.listInline) d[target.dataset.listInline][Number(target.dataset.index)] = text;
    renderStep();
    updateScore();
    scheduleSave();
  }

  function qualityChecks() {
    const d = currentDoc();
    const bullets = d.experiences.flatMap(exp => exp.bullets);
    const allSkills = [...d.skills.core, ...d.skills.tools, ...d.skills.domain];
    return [
      { ok: d.identity.name.trim().split(/\s+/).length >= 2, label: "Imię i nazwisko są kompletne" },
      { ok: d.identity.targetRole.trim().length >= 5, label: "Docelowa rola jest widoczna w nagłówku" },
      { ok: /@/.test(d.identity.email) && d.identity.phone.trim().length >= 7, label: "E-mail i telefon są uzupełnione" },
      { ok: d.summary.trim().length >= 80 && d.summary.trim().length <= 500, label: "Profil zawodowy ma konkretną, krótką formę" },
      { ok: d.experiences.some(exp => exp.role && exp.company && exp.start), label: "Co najmniej jedno stanowisko ma firmę i datę" },
      { ok: bullets.length >= 2, label: "Doświadczenie zawiera co najmniej dwa punkty" },
      { ok: bullets.some(point => /\d/.test(point)), label: "Co najmniej jeden punkt pokazuje liczbę lub skalę" },
      { ok: allSkills.length >= 4, label: "Umiejętności są pogrupowane i łatwe do skanowania" }
    ];
  }

  function updateScore() {
    const checks = qualityChecks();
    const score = Math.round((checks.filter(item => item.ok).length / checks.length) * 100);
    els.scoreValue.textContent = score;
    els.scoreRing.style.setProperty("--score", `${score * 3.6}deg`);
    els.scoreHint.textContent = currentDoc().layout.mode !== "single" && score >= 75 ? "Treść mocna — zachowaj też wersję 1-kolumnową" : score >= 88 ? "Gotowe do finalnej kontroli" : score >= 50 ? "Dobra baza — dopracuj szczegóły" : "Uzupełnij podstawy";
  }

  function goToStep(step) {
    if (step >= STEPS.length) { showToast("CV jest gotowe do eksportu."); return; }
    state.step = Math.max(0, Math.min(STEPS.length - 1, step));
    renderAll();
    document.querySelector(".editor-panel").scrollTo({ top: 0, behavior: "smooth" });
  }

  function switchLanguage(lang) {
    if (lang === state.lang) return;
    const source = currentDoc();
    const target = state.docs[lang];
    if (!target.identity.name && source.identity.name) {
      const clone = JSON.parse(JSON.stringify(source));
      const template = TEMPLATE_DEFS.find(item => item.id === source.templateId);
      clone.identity.targetRole = template ? (lang === "en" ? template.roleEn : template.role) : TRACKS[state.track].roles[lang];
      state.docs[lang] = clone;
      showToast(lang === "en" ? "Skopiowano fakty do wersji EN — przetłumacz treść." : "Skopiowano fakty do wersji PL — przetłumacz treść.");
    }
    state.lang = lang;
    bulletDraft = { experienceIndex: 0, action: "", task: "", tool: "", scale: "", result: "" };
    renderAll();
  }

  function moveSection(key, direction) {
    const order = currentDoc().sectionOrder;
    const index = order.indexOf(key);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
  }

  function setPath(object, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((cursor, key) => cursor[key], object);
    target[last] = value;
  }

  function exportPdf() {
    const previousTitle = document.title;
    document.title = `${filenamePart(currentDoc().identity.name)}_${filenamePart(currentDoc().identity.targetRole)}_${state.lang.toUpperCase()}`;
    window.print();
    setTimeout(() => { document.title = previousTitle; }, 500);
  }

  function resetCv() {
    if (!window.confirm("Rozpocząć nowe CV? Obecny lokalny zapis zostanie zastąpiony.")) return;
    state = defaultState();
    bulletDraft = { experienceIndex: 0, action: "", task: "", tool: "", scale: "", result: "" };
    renderAll();
    showToast("Utworzono nowe CV.");
  }

  async function readImportFile() {
    const file = els.importFile.files?.[0];
    if (!file) return;
    els.importText.value = await file.text();
  }

  function importContent() {
    const raw = els.importText.value.trim();
    if (!raw) { showToast("Wklej treść CV lub wybierz plik."); return; }
    try {
      if (raw.startsWith("{")) {
        const parsed = JSON.parse(raw);
        if (parsed.docs?.pl && parsed.docs?.en) {
          state = parsed;
          state.version = DATA_VERSION;
          state.docs.pl = normalizeDoc(state.docs.pl, "pl", state.track || "operations");
          state.docs.en = normalizeDoc(state.docs.en, "en", state.track || "operations");
        }
        else if (parsed.identity && parsed.experiences) state.docs[state.lang] = normalizeDoc(parsed, state.lang, state.track);
        else throw new Error("Nieznany format kopii");
      } else {
        state.docs[state.lang] = parseCvText(raw, currentDoc());
      }
      els.importDialog.close();
      els.importText.value = "";
      renderAll();
      showToast("Treść została zaimportowana. Sprawdź rozpoznane pola.");
    } catch (error) {
      showToast("Nie udało się odczytać pliku. Sprawdź jego format.");
    }
  }

  function parseCvText(text, base) {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const doc = JSON.parse(JSON.stringify(base));
    const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] || "";
    const phone = text.match(/(?:\+?\d[\s-]*){7,14}/)?.[0]?.trim() || "";
    const linkedIn = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s]+/i)?.[0] || "";
    const urls = text.match(/(?:https?:\/\/)?(?:www\.)?[\w-]+\.[a-z]{2,}(?:\/[^\s]*)?/gi) || [];
    doc.identity.name = lines[0] || doc.identity.name;
    if (lines[1] && !/@|\d{3}/.test(lines[1])) doc.identity.targetRole = lines[1];
    doc.identity.email = email || doc.identity.email;
    doc.identity.phone = phone || doc.identity.phone;
    doc.identity.linkedin = linkedIn || doc.identity.linkedin;
    doc.identity.portfolio = urls.find(url => !url.includes("linkedin.com") && !url.includes(email.split("@")[1] || "@@")) || doc.identity.portfolio;
    const bullets = lines.filter(line => /^[•·\-*–—]\s+/.test(line)).map(line => line.replace(/^[•·\-*–—]\s+/, ""));
    if (bullets.length) doc.experiences[0].bullets = bullets.slice(0, 8);
    const paragraph = text.split(/\n\s*\n/).map(value => value.replace(/\s+/g, " ").trim()).find(value => value.length > 100 && value.length < 600);
    if (paragraph) doc.summary = paragraph;
    return doc;
  }

  function downloadBackup() {
    downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }), `${filenamePart(currentDoc().identity.name)}_CV_Studio_backup.json`);
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 2800);
  }

  function exportDocx() {
    const d = currentDoc();
    const files = buildDocxFiles(d);
    const zip = createZip(files);
    const name = `${filenamePart(d.identity.name)}_${filenamePart(d.identity.targetRole)}_${state.lang.toUpperCase()}.docx`;
    downloadBlob(new Blob([zip], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), name);
    showToast("Plik DOCX został przygotowany lokalnie.");
  }

  function buildDocxFiles(d) {
    const labels = SECTION_LABELS[state.lang];
    const titleFor = key => d.sectionTitles[key] || labels[key] || d.customSections.find(section => section.id === key)?.title || key;
    const paragraphs = [];
    const p = (text, style = "Normal") => text ? `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>` : "";
    const bullet = text => `<w:p><w:pPr><w:pStyle w:val="Bullet"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
    paragraphs.push(p(d.identity.name || "CV", "Title"));
    paragraphs.push(p(d.identity.targetRole, "Subtitle"));
    paragraphs.push(p([d.identity.email, d.identity.phone, d.identity.city, d.identity.linkedin, d.identity.portfolio].filter(Boolean).join("  ·  "), "Contact"));
    const sectionWriters = {
      summary: () => d.summary ? p(titleFor("summary"), "Heading1") + p(d.summary) : "",
      experience: () => d.experiences.some(exp => exp.role || exp.company) ? p(titleFor("experience"), "Heading1") + d.experiences.map(exp => p(exp.role, "Heading2") + p([exp.company, exp.location, [exp.start, exp.end].filter(Boolean).join(" — ")].filter(Boolean).join("  ·  "), "Meta") + p(exp.context, "Italic") + exp.bullets.map(bullet).join("")).join("") : "",
      skills: () => Object.values(d.skills).flat().length ? p(titleFor("skills"), "Heading1") + [[state.lang === "pl" ? "Narzędzia" : "Tools", d.skills.tools], [state.lang === "pl" ? "Kluczowe" : "Core", d.skills.core], [state.lang === "pl" ? "Domenowe" : "Domain", d.skills.domain]].filter(([, values]) => values.length).map(([label, values]) => p(`${label}: ${values.join(" · ")}`)).join("") : "",
      education: () => (d.education.school || d.education.degree) ? p(titleFor("education"), "Heading1") + p([d.education.degree, d.education.school, d.education.date].filter(Boolean).join("  ·  ")) : "",
      certificates: () => d.certificates.length ? p(titleFor("certificates"), "Heading1") + d.certificates.map(item => p(item)).join("") : "",
      languages: () => d.languages.length ? p(titleFor("languages"), "Heading1") + d.languages.map(item => p(item)).join("") : "",
      consent: () => d.consent ? p(titleFor("consent"), "Heading1") + p(d.consent, "Small") : ""
    };
    d.customSections.forEach(section => {
      sectionWriters[section.id] = () => section.content.trim() ? p(section.title, "Heading1") + section.content.split(/\n/).map(line => line.trim()).filter(Boolean).map(bullet).join("") : "";
    });
    d.sectionOrder.forEach(key => paragraphs.push(sectionWriters[key]()));
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="900" w:bottom="850" w:left="900"/></w:sectPr></w:body></w:document>`;
    return {
      "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
      "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      "word/document.xml": documentXml,
      "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`,
      "word/styles.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/></w:rPr></w:rPrDefault></w:docDefaults>${styleXml("Normal", "Normal", 21, "233047", 0)}${styleXml("Title", "Title", 48, "0B1930", 1)}${styleXml("Subtitle", "Subtitle", 25, "246BFD", 1)}${styleXml("Contact", "Contact", 18, "536176", 0)}${styleXml("Heading1", "Heading 1", 20, "173B6C", 1, true)}${styleXml("Heading2", "Heading 2", 22, "172033", 1)}${styleXml("Meta", "Meta", 18, "59687D", 0)}${styleXml("Italic", "Italic", 18, "59687D", 0, false, true)}${styleXml("Small", "Small", 16, "59687D", 0)}${styleXml("Bullet", "Bullet", 21, "233047", 0)}</w:styles>`,
      "word/numbering.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="360"/></w:tabs><w:ind w:left="360" w:hanging="180"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`
    };
  }

  function styleXml(id, name, size, color, bold, caps = false, italic = false) {
    return `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:pPr><w:spacing w:before="${id === "Heading1" ? 220 : 0}" w:after="${id === "Title" ? 80 : 70}"/></w:pPr><w:rPr><w:color w:val="${color}"/><w:sz w:val="${size}"/>${bold ? "<w:b/>" : ""}${caps ? "<w:caps/><w:spacing w:val=\"16\"/>" : ""}${italic ? "<w:i/>" : ""}</w:rPr></w:style>`;
  }
  function xml(value) { return String(value || "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]); }

  function createZip(files) {
    const encoder = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    Object.entries(files).forEach(([name, content]) => {
      const nameBytes = encoder.encode(name);
      const data = encoder.encode(content);
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(local.buffer);
      view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0, true); view.setUint16(8, 0, true);
      view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, nameBytes.length, true);
      local.set(nameBytes, 30);
      parts.push(local, data);
      const dir = new Uint8Array(46 + nameBytes.length);
      const dirView = new DataView(dir.buffer);
      dirView.setUint32(0, 0x02014b50, true); dirView.setUint16(4, 20, true); dirView.setUint16(6, 20, true); dirView.setUint16(8, 0, true); dirView.setUint16(10, 0, true);
      dirView.setUint32(16, crc, true); dirView.setUint32(20, data.length, true); dirView.setUint32(24, data.length, true); dirView.setUint16(28, nameBytes.length, true); dirView.setUint32(42, offset, true);
      dir.set(nameBytes, 46); central.push(dir);
      offset += local.length + data.length;
    });
    const centralSize = central.reduce((sum, item) => sum + item.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, central.length, true); endView.setUint16(10, central.length, true); endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true);
    return concatBytes([...parts, ...central, end]);
  }

  let crcTable;
  function crc32(bytes) {
    if (!crcTable) crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function concatBytes(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    chunks.forEach(chunk => { output.set(chunk, offset); offset += chunk.length; });
    return output;
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function registerWebMcpTools() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const tools = [
      {
        name: "read_cv_progress", title: "Read CV progress", description: "Read the current CV language, selected track and ATS readiness without changing the document.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: () => ({ language: state.lang, track: state.track, atsScore: Math.round((qualityChecks().filter(item => item.ok).length / qualityChecks().length) * 100), currentStep: state.step + 1 })
      },
      {
        name: "update_cv_identity", title: "Update CV identity", description: "Update selected identity fields in the visible CV and save them locally.",
        inputSchema: { type: "object", properties: { name: { type: "string" }, targetRole: { type: "string" }, city: { type: "string" } }, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: input => {
          if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Input must be an object.");
          const allowed = ["name", "targetRole", "city"];
          for (const [key, value] of Object.entries(input)) {
            if (!allowed.includes(key)) throw new TypeError(`Unknown field: ${key}`);
            if (typeof value !== "string") throw new TypeError(`${key} must be a string.`);
          }
          allowed.forEach(key => { if (key in input) currentDoc().identity[key] = input[key].trim(); });
          renderAll();
          return { updated: true, identity: currentDoc().identity };
        }
      }
    ];
    tools.forEach(tool => { try { void Promise.resolve(context.registerTool(tool)).catch(() => {}); } catch (_) {} });
  }
})();
