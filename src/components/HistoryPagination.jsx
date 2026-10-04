import { useI18n } from "@/lib/i18n";
export default function HistoryPagination({ page, setPage, count }) {
  const { lang } = useI18n();
  const ka = lang === "ka";
  return (
    <div className="history-pagination">
      <button
        className="btn small ghost"
        aria-label={ka ? "წინა გვერდი" : "Previous page"}
        disabled={!page}
        onClick={() => setPage((v) => v - 1)}
      >
        ←
      </button>
      <span>
        {page + 1} / {Math.max(1, Math.ceil(count / 20))} · {count}
      </span>
      <button
        className="btn small ghost"
        aria-label={ka ? "შემდეგი გვერდი" : "Next page"}
        disabled={(page + 1) * 20 >= count}
        onClick={() => setPage((v) => v + 1)}
      >
        →
      </button>
    </div>
  );
}
