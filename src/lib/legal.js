export const LEGAL_VERSION = "2026-10-03";
export const LEGAL_CONTACT_EMAIL = "prodbyland@gmail.com";

export function createLegalAcceptance(acceptedLegal) {
  if (acceptedLegal !== true) {
    throw new Error(
      "Agreement to the Terms and Conditions and acknowledgement of the Privacy Policy are required.",
    );
  }
  return {
    legal_accepted: true,
    terms_version: LEGAL_VERSION,
    privacy_version: LEGAL_VERSION,
    legal_accepted_at: new Date().toISOString(),
  };
}

export const legalLabels = {
  en: {
    terms: "Terms and Conditions",
    privacy: "Privacy Policy",
    agree: "I agree to the",
    acknowledge: "and acknowledge the",
    required:
      "Please agree to the Terms and Conditions and acknowledge the Privacy Policy before registering.",
    risk: "I understand that accounts may be paused or suspended at any time, deposits involve financial risk, and balances and simulated profits are not guaranteed funds or returns. Liability exclusions are subject to applicable law.",
  },
  ka: {
    terms: "წესები და პირობები",
    privacy: "კონფიდენციალურობის პოლიტიკა",
    agree: "ვეთანხმები",
    acknowledge: "და გავეცანი",
    required:
      "რეგისტრაციამდე დაეთანხმეთ წესებსა და პირობებს და გაეცანით კონფიდენციალურობის პოლიტიკას.",
    risk: "მესმის, რომ ანგარიში შეიძლება ნებისმიერ დროს შეჩერდეს ან დაიბლოკოს, დეპოზიტები ფინანსურ რისკს შეიცავს, ხოლო ბალანსი და სიმულირებული მოგება არ წარმოადგენს გარანტირებულ თანხას ან შემოსავალს. პასუხისმგებლობის შეზღუდვა მოქმედებს კანონის ფარგლებში.",
  },
};

export const legalDocuments = {
  terms: {
    title: "Terms and Conditions",
    introduction:
      "These terms apply to the GNG website in the NovaEx project (the “Platform”). Read them before creating an account or making a payment. Creating an account requires your agreement to these terms.",
    sections: [
      [
        "Accounts and eligibility",
        "Use the Platform only if you are at least 18 years old and legally permitted to use it in your location. Provide accurate account information, protect your credentials, and do not use another person’s account or use the Platform for unlawful activity.",
      ],
      [
        "Account suspension and service pauses",
        "The Platform may pause, restrict, suspend, or close any account at any time, including for suspected fraud, security risks, misuse, legal requirements, payment disputes, or operational reasons. This can restrict login, deposits, trading features, and withdrawal requests. Notice will be provided where reasonably possible and legally required; urgent security or legal action may be taken without advance notice. Suspension does not itself transfer ownership of funds to the Platform or remove rights you have under applicable law.",
      ],
      [
        "Deposits and financial risk",
        "You make deposits and other payments at your own financial risk. Check the payment address, cryptocurrency, network, amount, and fees before sending funds. Blockchain transfers may be irreversible. The Platform does not guarantee deposit recovery, uninterrupted access, profit, preservation of value, or reimbursement for market losses, incorrect addresses or networks, or failures of independent payment providers outside its control. Do not send funds you cannot afford to lose.",
      ],
      [
        "What balances and AI activity represent",
        "Balances and holdings are internal account records. The current market-order feature updates those records rather than submitting trades to an external exchange. The AI feature calculates programmed balance credits and creates simulated trade activity; it does not demonstrate real AI execution in a market. Displayed percentages and projections are not guaranteed investment returns.",
      ],
      [
        "Withdrawals and payments",
        "Deposits use an external payment provider and depend on its confirmations and availability. The current withdrawal feature records a balance deduction and a completed withdrawal entry with a 20% fee, but does not initiate an on-chain payment. A displayed completed status therefore does not prove that funds were sent. Do not deposit on the assumption that this feature guarantees withdrawal or redemption. Mandatory refund, repayment, and consumer rights remain unaffected.",
      ],
      [
        "Plans, codes, and referrals",
        "Plan prices, eligibility, and rates appear in the Platform. A daily code must be redeemed within its validity period to apply its bonus to the relevant payout. Referral bonuses depend on the applicable rules. These features create internal credits; they are not a promise of actual investment performance. Material changes will be communicated as required by law and do not remove accrued legal rights.",
      ],
      [
        "Limits of responsibility",
        "To the extent permitted by applicable law, the Platform excludes responsibility for losses caused by market movements, your incorrect transfer instructions, your disclosure of account credentials, or independent third-party outages outside its reasonable control. It does not insure deposits or guarantee that money will be recovered. These terms do not exclude liability for fraud, deliberate misconduct, or any negligence, breach, refund obligation, or other liability that the law does not allow to be excluded. They do not waive ownership of your funds or mandatory consumer rights.",
      ],
      [
        "Privacy and third-party services",
        "The Privacy Policy explains how account and transaction information is used. Supabase, payment providers, and other external services may process information needed to provide their services. Their own terms may also apply.",
      ],
      [
        "Changes, questions, and applicable law",
        "The version date identifies these terms. Material updates will be communicated and renewed agreement requested where required by law. Applicable mandatory law governs your rights; these terms do not specify a court or waive rights to a lawful complaint. Contact the site operator at prodbyland@gmail.com for account, payment, or terms questions.",
      ],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    introduction:
      "This policy describes information processed by the GNG website in the NovaEx project (the “Platform”). It covers the features in this website and does not replace the privacy notices of its external service providers.",
    sections: [
      [
        "Information processed",
        "Account information includes your email address, authentication identifiers, and account creation details. Supabase handles your password and authentication. The Platform stores holdings, orders, deposit and withdrawal records, payment identifiers and addresses, plan settings, referral relationships, security preferences, and daily-code activity. Registration records the policy versions you accepted and an acceptance timestamp linked to your account. Hosting and service providers may process technical request information such as IP addresses and browser details.",
      ],
      [
        "Why information is used",
        "Information is used to authenticate accounts, display balances and activity, manage payment confirmations and referrals, administer accounts, investigate misuse, support users, and meet applicable legal duties. Where required, processing relies on providing the requested service, legal obligations, legitimate operational and security interests, or separately obtained consent. Acknowledging this notice is not consent to advertising or unrelated data uses.",
      ],
      [
        "Service providers and disclosures",
        "Supabase processes authentication and database information. NOWPayments receives payment information needed to create and confirm crypto payments. Requests for market prices go to Binance. Hosting and error-reporting services may receive technical and diagnostic information. The read-only chat group on this website displays daily codes and administrator news to signed-in members; these posts do not include user balances or email addresses. Authorized administrators can access account and transaction information. Information may also be disclosed when required by law or necessary to investigate security incidents.",
      ],
      [
        "Browser storage",
        "The site uses browser storage for authentication sessions, language preferences, and pending referral codes. These support login and requested features. Clearing browser storage can sign you out or remove preferences. Any additional tracking requiring consent must be disclosed and obtain that consent before use.",
      ],
      [
        "Retention and security",
        "Records are retained as needed to operate accounts, resolve disputes, prevent misuse, and meet applicable retention duties. Backup copies and legally required transaction records may remain after account closure. Security controls reduce risk but cannot guarantee complete protection or uninterrupted service. Do not share passwords or send unnecessary sensitive information.",
      ],
      [
        "Your choices and rights",
        "Depending on applicable law, you may request access, correction, deletion, restriction, portability, or object to certain processing, and may complain to a competent privacy authority. Contact the site operator at prodbyland@gmail.com. Identity verification may be required, and legal retention obligations may limit deletion. You can manage language and session preferences in your browser and sign out of your account.",
      ],
      [
        "International processing and children",
        "External providers may process data in countries other than yours, subject to safeguards required by applicable law. The Platform is intended for adults aged 18 and over. If a child’s data has been provided, contact the operator to request review and removal where appropriate.",
      ],
      [
        "Policy updates",
        "The version date identifies this policy. Material changes will be communicated as required by law. New purposes requiring consent will not be authorized merely by changing this policy.",
      ],
    ],
  },
};
