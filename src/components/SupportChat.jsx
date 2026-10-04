import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { BOT_PLANS } from "@/lib/plans";
import { LEGAL_CONTACT_EMAIL, legalLabels } from "@/lib/legal";
import { getSupportReply, supportText } from "@/lib/support";

export default function SupportChat() {
  const { lang } = useI18n();
  const language = lang === "ka" ? "ka" : "en";
  const text = supportText[language];
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const input = useRef(null);
  const launcher = useRef(null);
  const log = useRef(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [open, messages, language]);

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }

  function ask(value) {
    const next = value.trim().slice(0, 500);
    if (!next) return;
    setMessages((previous) => [...previous.slice(-19), { question: next }]);
    setQuestion("");
    input.current?.focus();
  }

  return (
    <aside className="support-widget" aria-label={text.title}>
      {open && (
        <section
          id="support-chat"
          className="support-panel"
          aria-labelledby="support-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <header className="support-header">
            <div>
              <h2 id="support-title">{text.title}</h2>
              <p>{text.note}</p>
            </div>
            <button
              type="button"
              className="support-icon-button"
              aria-label={text.close}
              onClick={close}
            >
              ×
            </button>
          </header>
          <div
            className="support-messages"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            ref={log}
          >
            <div className="support-answer">
              <strong>{text.bot}</strong>
              <p>{text.intro}</p>
            </div>
            {messages.map((message, index) => {
              const reply = getSupportReply(message.question, language, BOT_PLANS);
              return (
                <div key={index}>
                  <div className="support-question">
                    <strong>{text.you}</strong>
                    <p>{message.question}</p>
                  </div>
                  <div className="support-answer">
                    <strong>{text.bot}</strong>
                    <p>{reply.text}</p>
                    {reply.links.map((href) => (
                      <a key={href} href={href} target="_blank" rel="noopener noreferrer">
                        {href === "/privacy" ? legalLabels[language].privacy : text.ruleLink}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="support-suggestions">
            {text.suggestions.map((value) => (
              <button type="button" key={value} onClick={() => ask(value)}>
                {value}
              </button>
            ))}
          </div>
          <form
            className="support-form"
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
          >
            <input
              ref={input}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={500}
              aria-label={text.input}
              placeholder={text.placeholder}
              autoComplete="off"
            />
            <button className="btn small" type="submit" disabled={!question.trim()}>
              {text.send}
            </button>
          </form>
          <footer className="support-footer">
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{text.human}</a>
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setQuestion("");
                input.current?.focus();
              }}
            >
              {text.clear}
            </button>
          </footer>
        </section>
      )}
      <button
        ref={launcher}
        type="button"
        className="btn support-launcher"
        aria-controls="support-chat"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {open ? text.close : text.open}
      </button>
    </aside>
  );
}
