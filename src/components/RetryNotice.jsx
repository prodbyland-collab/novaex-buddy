import { useI18n } from "@/lib/i18n";
export default function RetryNotice({ error, onRetry, busy = false }) {
  const { lang } = useI18n();
  if (!error) return null;
  return (
    <div className="retry-notice" role="alert">
      <div>
        <strong>
          {lang === "ka" ? "მონაცემები ვერ ჩაიტვირთა" : "This section could not load"}
        </strong>
        <p>
          {typeof error === "string"
            ? error
            : lang === "ka"
              ? "სცადე ხელახლა."
              : "Please try again."}
        </p>
      </div>
      {onRetry && (
        <button className="btn small ghost" disabled={busy} onClick={onRetry}>
          {lang === "ka" ? "ხელახლა ცდა" : "Retry"}
        </button>
      )}
    </div>
  );
}
