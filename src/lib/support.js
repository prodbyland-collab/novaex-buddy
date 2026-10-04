import { LEGAL_CONTACT_EMAIL } from "./legal.js";

export const supportText = {
  en: {
    title: "GNG Support",
    open: "Support",
    close: "Close support",
    send: "Send",
    clear: "Clear chat",
    placeholder: "Ask about the website…",
    input: "Your question",
    you: "You",
    bot: "Support bot",
    intro:
      "Hi! I answer questions about the site’s rules. I cannot access your account or process payments. Please do not share passwords, private keys, or sensitive account details.",
    note: "Automatic answers · General website help",
    fallback: `I could not find a matching website rule. For account-specific help, email ${LEGAL_CONTACT_EMAIL}. I cannot verify payments, recover funds, or change accounts.`,
    suggestions: [
      "What is the minimum deposit?",
      "What do the bot plans cost?",
      "How does the daily code work?",
      "How do withdrawals work?",
    ],
    ruleLink: "Read the rules",
    human: "Email support",
  },
  ka: {
    title: "GNG მხარდაჭერა",
    open: "მხარდაჭერა",
    close: "ჩატის დახურვა",
    send: "გაგზავნა",
    clear: "ჩატის გასუფთავება",
    placeholder: "დასვით კითხვა ვებსაიტზე…",
    input: "თქვენი კითხვა",
    you: "თქვენ",
    bot: "მხარდაჭერის ბოტი",
    intro:
      "გამარჯობა! ვპასუხობ საიტის წესებთან დაკავშირებულ კითხვებს. თქვენს ანგარიშზე წვდომა არ მაქვს და გადახდებს ვერ ვასრულებ. არ გააზიაროთ პაროლი, პირადი გასაღები ან ანგარიშის მგრძნობიარე მონაცემები.",
    note: "ავტომატური პასუხები · საიტის შესახებ დახმარება",
    fallback: `თქვენს კითხვაზე შესაბამისი წესი ვერ ვიპოვე. ანგარიშთან დაკავშირებული დახმარებისთვის მოგვწერეთ: ${LEGAL_CONTACT_EMAIL}. ვერ ვამოწმებ გადახდებს, ვერ ვაბრუნებ თანხას და ვერ ვცვლი ანგარიშებს.`,
    suggestions: [
      "რამდენია მინიმალური დეპოზიტი?",
      "რა ღირს ბოტის პაკეტები?",
      "როგორ მუშაობს დღიური კოდი?",
      "როგორ ხდება თანხის გატანა?",
    ],
    ruleLink: "წესების ნახვა",
    human: "მიწერა მხარდაჭერასთან",
  },
};

const topics = [
  {
    id: "withdrawals",
    keywords: [
      "withdraw",
      "withdrawal",
      "cash out",
      "payout address",
      "გატან",
      "გამოტან",
      "გადმორიცხ",
      "გასატან",
    ],
    link: "/terms",
    en: "The current withdrawal feature deducts your internal balance, applies a 20% fee, and records a completed entry. It does not send an on-chain payment. A completed status does not prove that funds were sent. Contact support about any funds or withdrawal dispute.",
    ka: "თანხის გატანის მიმდინარე ფუნქცია შიდა ბალანსს აკლებს თანხას, ითვლის 20%-იან საკომისიოს და ქმნის დასრულებულ ჩანაწერს. ის ბლოკჩეინში თანხას არ აგზავნის. დასრულებული სტატუსი გადარიცხვას არ ადასტურებს. თანხასთან ან გატანის დავასთან დაკავშირებით დაუკავშირდით მხარდაჭერას.",
  },
  {
    id: "deposits",
    keywords: [
      "deposit",
      "fund account",
      "minimum",
      "nowpayments",
      "დეპოზიტ",
      "მინიმალურ",
      "შეტან",
      "ჩარიცხ",
      "ბალანსის შევსებ",
    ],
    link: "/terms",
    en: "Balance deposits start at $500; a higher payment-provider minimum may apply. In Wallet, choose the currency/network and amount, then follow the NOWPayments instructions. Your internal USD balance is credited after confirmation. Check the address and network carefully. I cannot confirm whether your payment arrived; contact support for missing or delayed deposits.",
    ka: "ბალანსის შესავსები მინიმალური დეპოზიტია $500; გადახდის პროვაიდერს შესაძლოა უფრო მაღალი მინიმუმი ჰქონდეს. საფულეში აირჩიეთ ვალუტა/ქსელი და თანხა, შემდეგ მიჰყევით NOWPayments-ის ინსტრუქციას. დადასტურების შემდეგ თანხა შიდა USD ბალანსზე აისახება. ყურადღებით გადაამოწმეთ მისამართი და ქსელი. გადახდის მიღებას ვერ ვამოწმებ; დაკარგულ ან დაგვიანებულ დეპოზიტზე დაუკავშირდით მხარდაჭერას.",
  },
  {
    id: "telegram",
    keywords: [
      "telegram",
      "daily code",
      "code",
      "boost",
      "expired code",
      "code expired",
      "ტელეგრამ",
      "კოდი",
      "დღიური კოდ",
      "დღის კოდ",
      "ბონუს კოდ",
      "კოდის ვადა",
      "chat group",
      "announcement",
      "news",
      "ჩატის ჯგუფ",
      "სიახლ",
    ],
    link: "/app/group",
    en: "The site bot posts the daily code in the read-only Chat group at 20:00 Georgian time. Only administrators can post news there. The daily code adds 1 percentage point to the daily programmed rate, on top of the bot plan and referral bonus. Redeem it on the Trading mode page within 10 minutes of posting. It applies to that day’s payout, so redeem each new daily code. I cannot generate, reveal, or renew a code.",
    ka: "საიტის ბოტი დღიურ კოდს მხოლოდ წაკითხვად ჩატის ჯგუფში საქართველოს დროით 20:00-ზე აქვეყნებს. სიახლეებს მხოლოდ ადმინისტრატორები აქვეყნებენ. დღიური კოდი პროგრამულ დღიურ განაკვეთს 1 პროცენტულ პუნქტს ამატებს ბოტის პაკეტისა და მოწვევის ბონუსის გარდა. გაააქტიურეთ ვაჭრობის რეჟიმის გვერდზე გამოქვეყნებიდან 10 წუთში. ის შესაბამისი დღის დარიცხვაზე მოქმედებს, ამიტომ ყოველდღე ახალი კოდი უნდა გაააქტიუროთ. კოდს ვერ ვქმნი, ვერ ვამჟღავნებ და ვადას ვერ ვუხანგრძლივებ.",
  },
  {
    id: "plans",
    keywords: ["bot plan", "plan", "tier", "pro", "elite", "free bot", "ბოტ", "პაკეტ", "გეგმ"],
    link: "/terms",
    en: "Bot plans can be purchased with your USD balance or a separate crypto payment. Balance purchases deduct the full plan price and activate immediately. The $500 balance-deposit minimum does not apply to plan purchases, although provider minimums still apply. Plan rates are programmed internal credits, not guaranteed investment returns.",
    ka: "ბოტის პაკეტების შეძენა შესაძლებელია USD ბალანსით ან კრიპტოთი ცალკე გადახდით. ბალანსით შეძენისას პაკეტის სრული ფასი ჩამოიჭრება და გეგმა მაშინვე გააქტიურდება. ბალანსის დეპოზიტის $500-იანი მინიმუმი პაკეტის შეძენას არ ეხება, თუმცა პროვაიდერის მინიმუმი მოქმედებს. პაკეტის პროცენტები პროგრამული შიდა დარიცხვებია და გარანტირებული საინვესტიციო შემოსავალი არ არის.",
  },
  {
    id: "referrals",
    keywords: ["referral", "refer", "invite", "friend", "მოწვევ", "მეგობ", "რეფერალ"],
    link: "/terms",
    en: "Share your invite link from the Referrals or Trading mode page. Each friend with a credited balance deposit adds 0.5 percentage points to your daily programmed rate, capped at 1 percentage point total. Plan purchases do not qualify. I cannot verify a friend’s deposit or change a referral.",
    ka: "მოწვევის ბმული გააზიარეთ მოწვევების ან ვაჭრობის რეჟიმის გვერდიდან. თითო მეგობარი ბალანსზე დარიცხული დეპოზიტით დღიურ პროგრამულ განაკვეთს 0.5 პროცენტულ პუნქტს უმატებს, ჯამურად მაქსიმუმ 1 პროცენტულ პუნქტამდე. პაკეტის შეძენა არ ითვლება. მეგობრის დეპოზიტს ვერ ვამოწმებ და მოწვევას ვერ ვცვლი.",
  },
  {
    id: "profit",
    keywords: [
      "profit",
      "earn",
      "return",
      "guarantee",
      "interest",
      "trading",
      "600",
      "45 days",
      "მოგებ",
      "შემოსავალ",
      "გარანტ",
      "ვაჭრობ",
      "დარიცხვ",
    ],
    link: "/terms",
    en: "Daily internal credits are calculated from your USD balance using the plan rate plus any valid daily-code and referral bonus. AI activity and market orders are simulated/internal records, not verified external trades. Displayed profits and projections are not guaranteed money or returns. Deposits involve financial risk.",
    ka: "დღიური შიდა დარიცხვა ითვლება USD ბალანსიდან, პაკეტის განაკვეთითა და მოქმედი დღიური კოდის და მოწვევის ბონუსებით. AI აქტივობა და საბაზრო ორდერები სიმულირებული/შიდა ჩანაწერებია და არა დადასტურებული გარე გარიგებები. ნაჩვენები მოგება და პროგნოზი გარანტირებული თანხა ან შემოსავალი არ არის. დეპოზიტი ფინანსურ რისკს შეიცავს.",
  },
  {
    id: "account",
    keywords: [
      "register",
      "registration",
      "sign up",
      "signup",
      "suspend",
      "pause",
      "blocked",
      "ban",
      "password",
      "login",
      "რეგისტრ",
      "შეჩერ",
      "დაბლოკ",
      "პაროლ",
      "შესვლა",
    ],
    link: "/terms",
    en: "Register with an email and password and check the agreement to the Terms and acknowledgement of the Privacy Policy. New accounts start at $0. Accounts may be paused, restricted, suspended, or closed at any time under the Terms, without removing mandatory legal rights. For login, password, or suspension problems, email support. I cannot unlock accounts or reset passwords.",
    ka: "რეგისტრაციისთვის მიუთითეთ ელფოსტა და პაროლი, დაეთანხმეთ წესებსა და პირობებს და დაადასტურეთ კონფიდენციალურობის პოლიტიკის გაცნობა. ახალი ანგარიშის ბალანსია $0. პირობების შესაბამისად ანგარიში შეიძლება ნებისმიერ დროს შეჩერდეს, შეიზღუდოს, დაიბლოკოს ან დაიხუროს, კანონით სავალდებულო უფლებების შენარჩუნებით. შესვლის, პაროლის ან შეჩერების პრობლემაზე მოგვწერეთ. ანგარიშს ვერ ვხსნი და პაროლს ვერ ვცვლი.",
  },
  {
    id: "privacy",
    keywords: [
      "privacy",
      "personal data",
      "delete data",
      "კონფიდენციალურ",
      "პერსონალურ",
      "მონაცემ",
    ],
    link: "/privacy",
    en: `The Privacy Policy explains account and transaction data, browser storage, providers, retention, and applicable rights. For access, correction, or deletion requests, email ${LEGAL_CONTACT_EMAIL}. This chat stays in this tab’s memory and is not sent to support or an external AI service.`,
    ka: `კონფიდენციალურობის პოლიტიკა აღწერს ანგარიშისა და ტრანზაქციების მონაცემებს, ბრაუზერის მეხსიერებას, პროვაიდერებს, შენახვასა და შესაბამის უფლებებს. წვდომის, გასწორების ან წაშლის მოთხოვნით მოგვწერეთ: ${LEGAL_CONTACT_EMAIL}. ეს ჩატი მხოლოდ ამ ჩანართის მეხსიერებაშია და მხარდაჭერას ან გარე AI სერვისს არ ეგზავნება.`,
  },
  {
    id: "contact",
    keywords: [
      "support",
      "contact",
      "human",
      "email",
      "help",
      "მხარდაჭერ",
      "დახმარებ",
      "კონტაქტ",
      "ელფოსტ",
    ],
    en: `Email ${LEGAL_CONTACT_EMAIL} for help from the site operator. For payment questions, include the payment or transaction ID and a brief description, but never passwords or private keys. This bot does not submit a ticket or contact staff for you.`,
    ka: `ოპერატორის დახმარებისთვის მოგვწერეთ: ${LEGAL_CONTACT_EMAIL}. გადახდის კითხვაში მიუთითეთ გადახდის ან ტრანზაქციის ID და მოკლე აღწერა, მაგრამ არასდროს პაროლი ან პირადი გასაღები. ბოტი თქვენს ნაცვლად მოთხოვნას არ აგზავნის და თანამშრომელს არ უკავშირდება.`,
  },
];

function normalize(value) {
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSupportReply(question, language = "en", plans = []) {
  const lang = language === "ka" ? "ka" : "en";
  const query = normalize(question).slice(0, 500);
  const words = query.split(" ");
  const matches = topics
    .map((topic) => ({
      topic,
      score: topic.keywords.reduce((score, keyword) => {
        const key = normalize(keyword);
        const found = key.includes(" ")
          ? ` ${query} `.includes(` ${key} `)
          : words.some((word) => word === key || (key.length >= 4 && word.startsWith(key)));
        return score + (found ? (key.includes(" ") ? 3 : 2) : 0);
      }, 0),
    }))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!matches.length) return { text: supportText[lang].fallback, links: [], topics: [] };
  const answers = matches.map(({ topic }) => {
    if (topic.id !== "plans" || !plans.length) return topic[lang];
    const prices = plans
      .map(
        (plan) =>
          `${plan.id === "free" ? (lang === "ka" ? "უფასო" : "Free") : plan.id === "pro" ? "Pro" : "Elite"}: $${plan.price}, ${plan.rate * 100}% ${lang === "ka" ? "დღეში" : "daily"}`,
      )
      .join("; ");
    return `${prices}. ${topic[lang]}`;
  });
  return {
    text: answers.join("\n\n"),
    links: [...new Set(matches.map(({ topic }) => topic.link).filter(Boolean))],
    topics: matches.map(({ topic }) => topic.id),
  };
}
