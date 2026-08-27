import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const translations = {
  ka: {
    nav: {
      markets: 'ბაზრები',
      whyNovax: 'რატომ NOVAX',
      security: 'უსაფრთხოება',
      portfolio: 'პორტფელი',
      aiTrading: 'AI ვაჭრობა',
      botPlans: 'ბოტ-გეგმები',
      orders: 'შეკვეთები',
      recurring: 'განმეორებადი',
      referrals: 'რეფერალები',
      wallet: 'საფულე',
    },
    common: {
      menu: 'მენიუ',
      close: 'დახურვა',
      login: 'შესვლა',
      signUp: 'რეგისტრაცია',
      signOut: 'გასვლა',
      dashboard: 'პანელზე გადასვლა →',
      language: 'ენა',
      portfolio: 'პორტფელი',
      email: 'ელფოსტა',
      password: 'პაროლი',
      backHome: '← მთავარ გვერდზე',
      pleaseWait: 'გთხოვთ, დაელოდოთ...',
    },
    landing: {
      heroEyebrow: 'ვაჭრობის მშვიდი გზა',
      heroTitle: 'იმოძრავე ბაზართან ერთად.|შეინარჩუნე კონტროლი.',
      heroText: 'გააზრებული სივრცე ციფრული აქტივებისთვის — მათთვის, ვისაც სურს ნათელი სურათი და სწრაფი შემდეგი ნაბიჯი.',
      startExploring: 'დაიწყე გაცნობა',
      seeHow: 'იხილე, როგორ მუშაობს',
      marketAccess: 'ბაზარზე წვდომა',
      spotFee: 'სპოტ საკომისიო',
      tradePairs: 'სავაჭრო წყვილი',
      portfolioValue: 'პორტფელის ღირებულება',
      liveSnapshot: 'ბაზრის ცოცხალი მიმოხილვა',
      marketOverview: 'ბაზრის მიმოხილვა',
      whatsMoving: 'იხილე, რა მოძრაობს.',
      tradeNow: 'ივაჭრე ახლა →',
      asset: 'აქტივი',
      lastPrice: 'ბოლო ფასი',
      change24h: '24სთ ცვლილება',
      marketCap: 'საბაზრო კაპიტალიზაცია',
      trade: 'ვაჭრობა',
      builtAroundYou: 'შენზე მორგებული',
      everythingTitle: 'ყველაფერი, რაც გჭირდება.|არაფერი ზედმეტი.',
      simpleTitle: 'სიმარტივე დიზაინში',
      simpleText: 'ერთი შეხედვით ნახე ბალანსი, შეკვეთები და ბაზრის მოძრაობა ზედმეტი ინფორმაციის გარეშე.',
      yourWayTitle: 'ივაჭრე შენებურად',
      yourWayText: 'სპოტი, პერიოდული შეძენა და გაფართოებული შეკვეთები — ერთ, კონცენტრირებულ სივრცეში.',
      securityTitle: 'უსაფრთხოება პირველ ადგილზე',
      securityText: 'დაცვა რამდენიმე დონეზე და გამჭვირვალე კონტროლი ანგარიშს შენს ხელში ტოვებს.',
      ready: 'როცა მზად ხარ',
      ctaTitle: 'შენი შემდეგი ნაბიჯი|იწყება აქ.',
      openAccount: 'გახსენი ანგარიში',
      footer: 'ორიგინალური ბირჟის სადესანტო გვერდის კონცეფცია.',
    },
    auth: {
      welcome: 'კეთილი იყოს შენი დაბრუნება',
      createAccount: 'შექმენი ანგარიში',
      loginSubtitle: 'შედი შენს პორტფელზე წვდომისთვის.',
      signupSubtitle: 'დაიწყე ვაჭრობა ერთ წუთზე ნაკლებ დროში.',
      login: 'შესვლა',
      signup: 'რეგისტრაცია',
      emailPlaceholder: 'you@example.com',
      passwordPlaceholder: 'მინიმუმ 6 სიმბოლო',
      submitLogin: 'შესვლა →',
      submitSignup: 'ანგარიშის შექმნა →',
      startingBalance: 'ახალი ანგარიშები იწყება $0-ით — შეავსე ბალანსი კრიპტო-დეპოზიტით.',
      genericError: 'რაღაც შეფერხდა',
    },
  },
  en: {
    nav: {
      markets: 'Markets',
      whyNovax: 'Why NOVAX',
      security: 'Security',
      portfolio: 'Portfolio',
      aiTrading: 'AI Trading',
      botPlans: 'Bot Plans',
      orders: 'Orders',
      recurring: 'Recurring',
      referrals: 'Referrals',
      wallet: 'Wallet',
    },
    common: {
      menu: 'Menu',
      close: 'Close',
      login: 'Log in',
      signUp: 'Create account',
      signOut: 'Sign out',
      dashboard: 'Go to dashboard →',
      language: 'Language',
      portfolio: 'Portfolio',
      email: 'Email',
      password: 'Password',
      backHome: '← Back to home',
      pleaseWait: 'Please wait...',
    },
    landing: {
      heroEyebrow: 'The calm way to trade',
      heroTitle: 'Move with the market.|Stay in control.',
      heroText: 'A thoughtful home for digital assets, built for people who want a clear view and a faster next move.',
      startExploring: 'Start exploring',
      seeHow: 'See how it works',
      marketAccess: 'market access',
      spotFee: 'spot fee from',
      tradePairs: 'trade pairs',
      portfolioValue: 'Portfolio value',
      liveSnapshot: 'Live market snapshot',
      marketOverview: 'Market overview',
      whatsMoving: "See what's moving.",
      tradeNow: 'Trade now →',
      asset: 'Asset',
      lastPrice: 'Last price',
      change24h: '24h change',
      marketCap: 'Market cap',
      trade: 'Trade',
      builtAroundYou: 'Built around you',
      everythingTitle: 'Everything you need.|Nothing in your way.',
      simpleTitle: 'Simple by design',
      simpleText: 'See balances, orders, and market movement at a glance without the clutter.',
      yourWayTitle: 'Trade your way',
      yourWayText: 'Spot, recurring buys, and advanced orders all live in one focused workspace.',
      securityTitle: 'Security first',
      securityText: 'Layered protection and transparent controls help keep your account in your hands.',
      ready: 'Ready when you are',
      ctaTitle: 'Your next move|starts here.',
      openAccount: 'Open your account',
      footer: 'Original exchange landing page concept.',
    },
    auth: {
      welcome: 'Welcome back',
      createAccount: 'Create your account',
      loginSubtitle: 'Sign in to access your portfolio.',
      signupSubtitle: 'Start trading in under a minute.',
      login: 'Log in',
      signup: 'Sign up',
      emailPlaceholder: 'you@example.com',
      passwordPlaceholder: 'At least 6 characters',
      submitLogin: 'Log in →',
      submitSignup: 'Create account →',
      startingBalance: 'New accounts start at $0 — fund your balance with a crypto deposit.',
      genericError: 'Something went wrong',
    },
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('ka');

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem('novax_language');
    if (savedLanguage === 'en' || savedLanguage === 'ka') setLanguage(savedLanguage);
  }, []);

  const value = useMemo(() => ({
    language,
    setLanguage: (nextLanguage) => {
      window.localStorage.setItem('novax_language', nextLanguage);
      setLanguage(nextLanguage);
    },
    t: (key) => key.split('.').reduce((value, segment) => value?.[segment], translations[language]) || key,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}
