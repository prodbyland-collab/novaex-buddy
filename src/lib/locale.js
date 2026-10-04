const georgianMonths = {
  Jan: "იან.",
  Feb: "თებ.",
  Mar: "მარ.",
  Apr: "აპრ.",
  May: "მაი.",
  Jun: "ივნ.",
  Jul: "ივლ.",
  Aug: "აგვ.",
  Sep: "სექ.",
  Oct: "ოქტ.",
  Nov: "ნოე.",
  Dec: "დეკ.",
};

// Explicit month names also support browsers without Georgian Intl locale data.
export function formatDateTime(value, lang = "en", includeTime = true) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return "—";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tbilisi",
      day: "numeric",
      month: "short",
      year: "numeric",
      ...(includeTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const month = lang === "ka" ? georgianMonths[parts.month] : parts.month;
  return `${parts.day} ${month} ${parts.year}${includeTime ? `, ${parts.hour}:${parts.minute}` : ""}`;
}
