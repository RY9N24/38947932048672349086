"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { io, Socket } from "socket.io-client";
import { toast } from "./notifications";
import ReactMarkdown from "react-markdown";
import { plural, api, Loading, Failure, Clock, Standings, verdict, time } from "./lib";
const CodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => <div className="editor-skeleton" role="status" aria-label="Загрузка редактора"><i/><i/><i/><i/></div>,
});
const starters: Record<string, string> = {
  python: "# Решение на Python 3.12\n",
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n",
};
export default function Arena({
  id,
  user,
  match,
}: {
  id: string;
  user: any;
  match?: any;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [active, setActive] = useState(""),
    [language, setLanguage] = useState("python"),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [view, setView] = useState("work"),
    [partnerCode, setPartnerCode] = useState(false),
    [online, setOnline] = useState(false),
    [activity, setActivity] = useState(false),
    [chat, setChat] = useState(""),
    [fallback, setFallback] = useState(false),
    [cooldown, setCooldown] = useState(false),
    [saved, setSaved] = useState(true);
  const socket = useRef<Socket | null>(null),
    state = useRef({
      code: "",
      language: "python",
      problemId: "",
      seq: 0,
      sessionId: "",
    }),
    chain = useRef<Promise<any>>(Promise.resolve()),
    lastSaved = useRef(""),
    copied = useRef(""),
    ready = useRef(false),
    saveError = useRef(false),
    recordingOpen = useRef(true),
    pendingEvents = useRef<any[]>([]),
    sessionsRef = useRef(new Map<string, { seq: number; id: string }>());
  async function load() {
    try {
      const d = await api("/contexts/" + id + "/workspace");
      setData(d);
      setError("");
      recordingOpen.current =
        !!d.startAt &&
        Date.now() >= +new Date(d.startAt) &&
        Date.now() < +new Date(d.endsAt) &&
        !d.match?.surrenderedId;
      if (!ready.current && d.problems.length) {
        ready.current = true;
        select(d.problems[0].id, d);
      }
      return d;
    } catch (e: any) {
      if (!ready.current) setError(e.message);
      else setOnline(false);
    }
  }
  function select(pid: string, d = data) {
    const draft = d.drafts.find((x: any) => x.problemId === pid);
    const text = draft?.code || starters[draft?.language || "python"];
    state.current = {
      code: text,
      language: draft?.language || "python",
      problemId: pid,
      seq: draft?.seq || 0,
      sessionId: draft?.id || "",
    };
    lastSaved.current = draft?.code || "";
    sessionsRef.current.set(pid, { seq: draft?.seq || 0, id: draft?.id || "" });
    setSaved(!!draft);
    setActive(pid);
    setCode(text);
    setLanguage(state.current.language);
    setPartnerCode(false);
  }
  function flushRecording() {
    chain.current = chain.current.then(async () => {
      while (pendingEvents.current.length) {
        const event = pendingEvents.current[0];
        const known = sessionsRef.current.get(event.problemId) || {
          seq: 0,
          id: "",
        };
        try {
          const result = await api("/contexts/" + id + "/editor", {
            problemId: event.problemId,
            code: event.code,
            language: event.language,
            type: event.type,
            meta: event.meta,
            seq: known.seq + 1,
          });
          sessionsRef.current.set(event.problemId, {
            seq: result.seq,
            id: result.id,
          });
          pendingEvents.current.shift();
          if (state.current.problemId === event.problemId) {
            state.current.seq = result.seq;
            state.current.sessionId = result.id;
            lastSaved.current = event.code;
            setSaved(state.current.code === event.code);
          }
          saveError.current = false;
        } catch (e: any) {
          if (!saveError.current) toast(e.message);
          saveError.current = true;
          break;
        }
      }
    });
    return chain.current;
  }
  function record(type = "change", meta: any = {}) {
    const snapshot = { ...state.current, type, meta };
    if (!snapshot.problemId || !recordingOpen.current) return chain.current;
    const previous = pendingEvents.current.at(-1);
    if (
      !(
        type === "change" &&
        previous?.type === "change" &&
        previous.code === snapshot.code &&
        previous.problemId === snapshot.problemId
      )
    )
      pendingEvents.current.push(snapshot);
    return flushRecording();
  }
  useEffect(() => {
    load();
    const s = io();
    socket.current = s;
    s.on("connect", () => {
      s.emit("join", id);
      setOnline(true);
      flushRecording();
    });
    s.on("disconnect", () => setOnline(false));
    s.on("refresh", load);
    s.on("draft", ({ userId }: any) => {
      if (userId !== user.id) load();
    });
    s.on("activity", ({ userId }: any) => {
      if (userId !== user.id) {
        setActivity(true);
        setTimeout(() => setActivity(false), 3000);
      }
    });
    const poll = setInterval(load, 5000);
    const auto = setInterval(() => {
      if (state.current.code !== lastSaved.current) record();
    }, 3000);
    const visibility = () => record(document.hidden ? "blur" : "focus");
    document.addEventListener("visibilitychange", visibility);
    return () => {
      s.disconnect();
      clearInterval(poll);
      clearInterval(auto);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [id]);
  useEffect(() => {
    if (!data?.partner || saved) return;
    const timer = setTimeout(() => record(), 500);
    return () => clearTimeout(timer);
  }, [code, data?.partner?.id, saved]);
  async function submit(sample = false) {
    setBusy(true);
    try {
      await record(sample ? "run" : "submit");
      if (saveError.current)
        throw Error("Дождитесь восстановления записи и повторите отправку");
      const s = state.current;
      await api("/submissions", {
        contextId: id,
        problemId: s.problemId,
        language: s.language,
        code: s.code,
        editorSessionId: s.sessionId,
        seq: s.seq,
        sample,
      });
      setCooldown(true);
      setTimeout(() => setCooldown(false), 5100);
      toast(sample ? "Пример отправлен на проверку" : "Решение в очереди");
      await load();
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (error) return <Failure text={error} />;
  if (!data) return <Loading />;
  const problem = data.problems.find((p: any) => p.id === active),
    ctx = data.contest || data.match;
  const isMatch = !!data.match;
  const opponent = data.standings.find((r: any) => r.id !== user.id);
  const my = data.standings.find((r: any) => r.id === user.id);
  const claim = data.claims.find((c: any) => c.problemId === active);
  const partnerDraft = data.partnerDrafts.find(
    (d: any) => d.problemId === active,
  );
  const finished =
    !!data.match?.surrenderedId ||
    (data.endsAt && Date.now() >= +new Date(data.endsAt));
  const beforeStart = data.startAt && Date.now() < +new Date(data.startAt);
  return (
    <>
      <div className="arena-toolbar">
        <div>
          <p className="eyebrow">
            {isMatch
              ? "ДУЭЛЬ / 1 НА 1"
              : data.contest.format === "TEAM"
                ? "КОМАНДНЫЙ ЗАЧЁТ"
                : "ЛИЧНЫЙ ЗАЧЁТ"}
          </p>
          <h1>{data.contest?.title || "Общий старт. Равные условия."}</h1>
        </div>
        <span className="recording">
          <i />
          Запись решения
        </span>
        <div>
          <small className="eyebrow">ДО КОНЦА</small>
          <Clock endsAt={data.endsAt} />
        </div>
      </div>
      {isMatch && (
        <div className="arena-score">
          <div>
            <h2>{user.name}</h2>
            <span>Вы · {my?.solved || 0} решено</span>
          </div>
          <strong>
            {my?.solved || 0}
            <span>:</span>
            {opponent?.solved || 0}
          </strong>
          <div>
            <h2>{opponent?.name || "Соперник"}</h2><div className="opponent-task-progress" aria-label="Задачи соперника">{opponent?.cells?.map((cell:any,i:number)=><span key={cell.problemId} className={cell.solved?'solved':''}>{String.fromCharCode(65+i)} {cell.solved?'OK':cell.pending?'…':'—'}</span>)}</div>
            <span>
              {activity
                ? "Пишет код"
                : online
                  ? "Связь установлена"
                  : "Соединение потеряно. Таймер идёт."}
            </span>
          </div>
          <button
            className="text-button"
            onClick={async () => {
              if (confirm("Сдаться? Вам будет засчитано поражение.")) {
                await api("/matches/" + id + "/surrender", { confirm: true });
                location.href = "/matches/" + id;
              }
            }}
          >
            Сдаться
          </button>
        </div>
      )}
      <div className="arena-tabs">
        <button aria-pressed={view === "work"} onClick={() => setView("work")}>
          Рабочее место
        </button>
        <button
          aria-pressed={view === "standings"}
          onClick={() => setView("standings")}
        >
          Протокол
        </button>
        <span className="mono muted">
          {online
            ? "СОХРАНЕНИЕ ВКЛЮЧЕНО"
            : "НЕТ СВЯЗИ · КОД ОСТАЁТСЯ В РЕДАКТОРЕ"}
        </span>
      </div>
      {view === "standings" ? (
        <Standings
          rows={data.standings}
          problems={data.problems}
          mode={data.contest?.scoring}
        />
      ) : (
        <div className="workspace">
          <aside className="task-rail">
            <p className="eyebrow">ЗАДАЧИ</p>
            {data.problems.map((p: any, i: number) => (
              <button
                key={p.id}
                aria-pressed={active === p.id}
                onClick={async () => {
                  await record();
                  const fresh = await load();
                  if (fresh) select(p.id, fresh);
                }}
              >
                <span className="problem-letter">
                  {String.fromCharCode(65 + i)}
                </span>
                <span>
                  {p.title}
                  <small>
                    {data.submissions.some(
                      (s: any) =>
                        s.problemId === p.id && s.status === "OK" && !s.sample,
                    )
                      ? "OK · Решено"
                      : p.timeMs + " мс"}
                  </small>
                </span>
              </button>
            ))}
            {data.partner && (
              <div className="partner-summary">
                <p className="eyebrow">НАПАРНИК</p>
                <h3>{data.partner.name}</h3>
                <p className="muted">Общий зачёт. Отправить может каждый.</p>
                <button
                  onClick={async () => {
                    await api("/contexts/" + id + "/claim", {
                      problemId: active,
                      release: claim?.userId === user.id,
                    });
                    load();
                  }}
                >
                  {claim?.userId === user.id
                    ? "Отдать задачу"
                    : claim?.userId
                      ? "Забрать задачу"
                      : "Взять задачу"}
                </button>
                <div className="team-contribution">
                  {data.contributions?.map((c: any) => (
                    <p key={c.userId}>
                      <strong>
                        {c.userId === user.id ? "Вы" : c.name?.split(" ")[0]}
                      </strong>
                      <span>
                        {c.attempts} {plural(c.attempts,"попытка","попытки","попыток")} / {c.accepted} OK
                      </span>
                    </p>
                  ))}
                </div>
                <p className="mono">
                  {claim?.userId === user.id
                    ? "Вы взяли задачу"
                    : claim?.userId
                      ? "Задача у напарника"
                      : "Задача свободна"}
                </p>
              </div>
            )}
          </aside>
          <div className="work-center">
            <article className="statement">
              <div className="section-heading">
                <h2>
                  {String.fromCharCode(
                    65 + data.problems.findIndex((p: any) => p.id === active),
                  )}
                  . {problem?.title}
                </h2>
                <span className="mono muted">
                  {problem?.timeMs} мс / {problem?.memoryMb} МБ
                </span>
              </div>
              <ReactMarkdown>{problem?.statement || ""}</ReactMarkdown>
              {problem?.tests.map((t: any, i: number) => (
                <div className="sample" key={i}>
                  <div>
                    <span className="eyebrow">ВХОД</span>
                    <pre>{t.input}</pre>
                  </div>
                  <div>
                    <span className="eyebrow">ВЫХОД</span>
                    <pre>{t.output}</pre>
                  </div>
                </div>
              ))}
            </article>
            <section className="code-pane">
              <div className="editor-bar">
                <label className="sr-only" htmlFor="language">
                  Язык решения
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    state.current.language = e.target.value;
                  }}
                >
                  <option value="python">Python 3.12</option>
                  <option value="cpp">C++17 / GCC 14</option>
                </select>
                {data.partner && (
                  <button
                    aria-pressed={partnerCode}
                    onClick={() => setPartnerCode(!partnerCode)}
                  >
                    {partnerCode ? "Мой код" : "Код напарника"}
                  </button>
                )}
                <button
                  className="text-button"
                  onClick={() => setFallback(!fallback)}
                >
                  {fallback ? "Полный редактор" : "Простой редактор"}
                </button>
                <span className="muted mono">
                  {partnerCode
                    ? "ТОЛЬКО ЧТЕНИЕ"
                    : "main." + (language === "python" ? "py" : "cpp")}
                </span>
              </div>
              <div
                className="editor-body"
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  setTimeout(
                    () =>
                      record("paste", {
                        length: text.length,
                        internal: text === copied.current,
                      }),
                    0,
                  );
                }}
                onCopy={() => {
                  copied.current = window.getSelection()?.toString() || "";
                }}
              >
                {fallback ? (
                  <textarea
                    aria-label="Код решения"
                    spellCheck={false}
                    value={partnerCode ? partnerDraft?.code || "" : code}
                    readOnly={partnerCode || finished || beforeStart}
                    onChange={(e) => {
                      setCode(e.target.value);
                      state.current.code = e.target.value;
                      setSaved(false);
                      socket.current?.emit("activity");
                    }}
                  />
                ) : (
                  <CodeEditor
                    value={partnerCode ? partnerDraft?.code || "" : code}
                    language={language}
                    readOnly={partnerCode || finished || beforeStart}
                    onChange={(text) => {
                      setCode(text);
                      state.current.code = text;
                      setSaved(false);
                      socket.current?.emit("activity");
                    }}
                    onCopy={(text) => {
                      copied.current = text;
                    }}
                  />
                )}
              </div>
              <div className="editor-actions">
                <span className="muted">
                  {finished
                    ? "Соревнование завершено"
                    : partnerCode
                      ? "Код напарника виден только вашей команде"
                      : saved
                        ? "Изменения сохранены"
                        : "Сохраняем изменения…"}
                </span>
                <button
                  disabled={
                    busy || cooldown || finished || partnerCode || beforeStart
                  }
                  onClick={() => submit(true)}
                >
                  Запустить пример
                </button>
                <button
                  className="primary"
                  disabled={
                    busy || cooldown || finished || partnerCode || beforeStart
                  }
                  onClick={() => submit(false)}
                >
                  {busy ? "Отправляем…" : "Отправить решение"}
                </button>
              </div>
            </section>
            {data.partner && (
              <section className="team-chat">
                <div className="section-heading">
                  <h3>Переговорная</h3>
                </div>
                <div className="chat-history">
                  {data.chat.map((c: any) => (
                    <p key={c.id}>
                      <span className="mono muted">
                        {time(c.createdAt)} ·{" "}
                        {c.userId === user.id
                          ? "Вы"
                          : data.partner.name.split(" ")[0]}
                      </span>{" "}
                      {c.text}
                    </p>
                  ))}
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await api("/contexts/" + id + "/chat", { text: chat });
                    setChat("");
                    load();
                  }}
                >
                  <input
                    aria-label="Сообщение напарнику"
                    placeholder="Сообщение напарнику"
                    value={chat}
                    maxLength={500}
                    onChange={(e) => setChat(e.target.value)}
                    required
                  />
                  <button>Отправить сообщение</button>
                </form>
              </section>
            )}
          </div>
          <aside className="attempts">
            <p className="eyebrow">
              {data.partner ? "ПОПЫТКИ КОМАНДЫ" : "МОИ ПОПЫТКИ"}
            </p>
            {data.submissions.length ? (
              data.submissions.map((s: any) => (
                <details
                  key={s.id}
                  data-submission-id={s.id}
                    className={"attempt " + s.status.toLowerCase()}
                >
                  <summary>
                    <span className="mono">
                      {time(s.createdAt)} /{" "}
                      {String.fromCharCode(
                        65 +
                          data.problems.findIndex(
                            (p: any) => p.id === s.problemId,
                          ),
                      )}
                    </span>
                    <strong>{verdict[s.status] || s.status}</strong>
                    {s.sample && <small>На примере · вне зачёта</small>}
                  </summary>
                  <p>
                    {s.result?.tests?.length
                      ? `Тест ${s.result.tests.find((t: any) => t.verdict !== "OK")?.i || s.result.tests.length} / ${s.result.tests.length}`
                      : "Ожидаем результат"}
                  </p>
                  {s.result?.compileLog && <pre>{s.result.compileLog}</pre>}
                  {s.result?.message && <p>{s.result.message}</p>}
                </details>
              ))
            ) : (
              <p className="muted">
                Отправок пока нет.
                <br />
                Результат проверки появится здесь.
              </p>
            )}
            <div className="judge-note">
              <span className="eyebrow">ПРОВЕРКА</span>
              <p>Без сети. Ограничены время, память и число процессов.</p>
            </div>
          </aside>
        </div>
      )}
      {beforeStart && (
        <div className="countdown">
          <strong>
            {Math.max(
              1,
              Math.ceil((+new Date(data.startAt) - Date.now()) / 1000),
            )}
          </strong>
          <span>Приготовьтесь</span>
        </div>
      )}
    </>
  );
}
