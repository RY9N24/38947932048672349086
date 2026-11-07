"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "./notifications";
import {
  plural,
  api,
  useLoad,
  Title,
  Loading,
  Failure,
  status,
  Tag,
  time,
  date,
  verdict,
} from "./lib";
export function Organizer({
  user,
  version,
  refresh,
}: {
  user: any;
  version: number;
  refresh: () => void;
}) {
  const [tab, setTab] = useState("contests");
  const [validationProblem, setValidationProblem] = useState<any>(null);
  const { data: problems, error } = useLoad("/problems", version),
    { data: contests } = useLoad("/contests", version);
  const [actionError, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (user.role !== "ORGANIZER")
    return <Failure text="Судейская доступна только организатору" />;
  async function save(path: string, body: any) {
    setBusy(true);
    setError("");
    try {
      await api(path, body);
      refresh();
      setTab(path === "/problems" ? "problems" : "contests");
      toast(path === "/problems" ? "Задача сохранена" : "Контест опубликован");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Title section="ОРГАНИЗАТОР" title="Судейская">
        <Link className="button" href="/records">
          Проверить честность
        </Link>
      </Title>
      <div className="org-layout">
        <aside className="org-index">
          <button
            aria-current={tab === "contests" ? "page" : undefined}
            onClick={() => setTab("contests")}
          >
            Контесты <span>{contests?.length || 0}</span>
          </button>
          <button
            aria-current={tab === "problems" ? "page" : undefined}
            onClick={() => setTab("problems")}
          >
            Банк задач <span>{problems?.length || 0}</span>
          </button>
          <div className="org-index-rule" />
          <button onClick={() => setTab("new-contest")}>Создать контест</button>
          <button onClick={() => setTab("new-problem")}>Добавить задачу</button>
          <p className="muted">
            Сначала условие и тесты.
            <br />
            Затем состав и время раунда.
          </p>
        </aside>
        <section className="org-workspace">
          {error && <Failure text={error} />}{" "}
          {actionError && (
            <p className="error" role="alert">
              {actionError}
            </p>
          )}
          {tab === "contests" && (
            <>
              <div className="section-heading">
                <h2>Контесты</h2>
                <button
                  className="primary"
                  onClick={() => setTab("new-contest")}
                >
                  Создать контест
                </button>
              </div>
              {!contests ? (
                <Loading />
              ) : (
                contests.map((c: any) => (
                  <Link
                    className="org-contest"
                    href={"/contests/" + c.id}
                    key={c.id}
                  >
                    <div>
                      <h3>{c.title}</h3>
                      <span className="muted mono">
                        {date(c.startAt)} / {time(c.startAt)} / {c.duration} мин
                      </span>
                    </div>
                    <Tag live={status(c) === "Идёт"}>{status(c)}</Tag>
                    <span>↗</span>
                  </Link>
                ))
              )}
            </>
          )}
          {tab === "problems" && (
            <>
              <div className="section-heading">
                <h2>Банк задач</h2>
                <button
                  className="primary"
                  onClick={() => setTab("new-problem")}
                >
                  Добавить задачу
                </button>
              </div>
              {problems?.map((p: any, i: number) => (
                <div className="problem-row" key={p.id}>
                  <span className="problem-letter">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <div>
                    <h3>{p.title}</h3>
                    <span className="muted mono">
                      {p.timeMs} мс / {p.memoryMb} МБ / {p.tests.length} {plural(p.tests.length,"тест","теста","тестов")}
                    </span>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setValidationProblem(p);
                      setTab("validate");
                    }}
                  >
                    Проверить эталоном
                  </button>
                </div>
              ))}
            </>
          )}
          {tab === "new-problem" && (
            <ProblemForm busy={busy} onSave={(d) => save("/problems", d)} />
          )}{" "}
          {tab === "validate" && validationProblem && (
            <ProblemValidator problem={validationProblem} />
          )}
          {tab === "new-contest" && (
            <ContestForm
              problems={problems || []}
              busy={busy}
              onSave={(d) => save("/contests", d)}
            />
          )}
        </section>
      </div>
    </>
  );
}
function ProblemValidator({ problem }: { problem: any }) {
  const [code, setCode] = useState(
      problem.id === "sum"
        ? "a,b=map(int,input().split())\nprint(a+b)"
        : "n=int(input())\nprint(n*n)",
    ),
    [language, setLanguage] = useState("python"),
    [submission, setSubmission] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!submission || !["QUEUED", "RUNNING"].includes(submission.status))
      return;
    const t = setInterval(
      () =>
        api("/submissions/" + submission.id)
          .then(setSubmission)
          .catch((e) => setError(e.message)),
      1000,
    );
    return () => clearInterval(t);
  }, [submission?.id, submission?.status]);
  return (
    <section className="editor-form">
      <p className="eyebrow">ПРОВЕРКА ЗАДАЧИ</p>
      <h2>{problem.title}</h2>
      <p className="muted">
        Эталон запускается на всех тестах в той же изолированной среде, что и
        решения участников.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            setSubmission(
              await api("/problems/" + problem.id + "/verify", {
                code,
                language,
              }),
            );
          } catch (e: any) {
            setError(e.message);
          }
        }}
      >
        <label>
          Язык эталона
          <select
            aria-label="Язык эталона"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="python">Python 3.12</option>
            <option value="cpp">C++17</option>
          </select>
        </label>
        <label>
          Код эталона
          <textarea
            aria-label="Код эталона"
            className="reference-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={9}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button
          className="primary"
          disabled={
            submission && ["QUEUED", "RUNNING"].includes(submission.status)
          }
        >
          Запустить проверку
        </button>
      </form>
      {submission && (
        <div role="status" className="validation-result">
          <h3>{verdict[submission.status]}</h3>
          {submission.result?.tests?.map((t: any) => (
            <p className="mono" key={t.i}>
              Тест {t.i} / {t.verdict} / {t.timeMs} мс
            </p>
          ))}
          {submission.result?.compileLog && (
            <pre>{submission.result.compileLog}</pre>
          )}
        </div>
      )}
    </section>
  );
}
function ProblemForm({
  onSave,
  busy,
}: {
  onSave: (d: any) => void;
  busy: boolean;
}) {
  const [tests, setTests] = useState([
    { input: "2\n", output: "4\n", sample: true },
    { input: "-3\n", output: "9\n", sample: false },
    { input: "0\n", output: "0\n", sample: false },
  ]);
  return (
    <form
      className="editor-form"
      onSubmit={(e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget));
        onSave({
          ...d,
          timeMs: Number(d.timeMs),
          memoryMb: Number(d.memoryMb),
          tests,
          duelPool: true,
          checker: "tokens",
        });
      }}
    >
      <p className="eyebrow">БЛАНК ЗАДАЧИ</p>
      <h2>Условие и проверка</h2>
      <label>
        Название
        <input
          name="title"
          required
          minLength={2}
          maxLength={120}
          defaultValue="Квадрат числа"
        />
      </label>
      <label>
        Условие (Markdown)
        <textarea
          name="statement"
          required
          minLength={10}
          rows={7}
          defaultValue={
            "Дано целое число n. Найдите его квадрат.\n\n### Входные данные\nОдно целое число, −1000 ≤ n ≤ 1000.\n\n### Выходные данные\nВыведите квадрат числа n."
          }
        />
      </label>
      <div className="form-columns">
        <label>
          Время, мс
          <input
            type="number"
            name="timeMs"
            defaultValue={1000}
            min={100}
            max={3000}
            required
          />
        </label>
        <label>
          Память, МБ
          <input
            type="number"
            name="memoryMb"
            defaultValue={256}
            min={64}
            max={512}
            required
          />
        </label>
      </div>
      <div className="section-heading">
        <h3>Тесты</h3>
        <button
          type="button"
          onClick={() =>
            setTests((ts) => [...ts, { input: "", output: "", sample: false }])
          }
        >
          Добавить тест
        </button>
      </div>
      {tests.map((t, i) => (
        <fieldset className="test-fields" key={i}>
          <legend>Тест {i + 1}</legend>
          <div className="form-columns">
            <label>
              Вход
              <textarea
                aria-label={`Вход теста ${i + 1}`}
                required
                value={t.input}
                onChange={(e) =>
                  setTests((ts) =>
                    ts.map((x, n) =>
                      n === i ? { ...x, input: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Ожидаемый выход
              <textarea
                aria-label={`Выход теста ${i + 1}`}
                required
                value={t.output}
                onChange={(e) =>
                  setTests((ts) =>
                    ts.map((x, n) =>
                      n === i ? { ...x, output: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={t.sample}
              onChange={(e) =>
                setTests((ts) =>
                  ts.map((x, n) =>
                    n === i ? { ...x, sample: e.target.checked } : x,
                  ),
                )
              }
            />
            Показывать участнику как пример
          </label>
        </fieldset>
      ))}
      <button className="primary" disabled={busy}>
        {busy ? "Сохраняем…" : "Сохранить задачу"}
      </button>
    </form>
  );
}
function ContestForm({
  problems,
  onSave,
  busy,
}: {
  problems: any[];
  onSave: (d: any) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <form
      className="editor-form"
      onSubmit={(e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget));
        onSave({
          title: d.title,
          description: d.description,
          format: d.format,
          scoring: d.scoring,
          duration: Number(d.duration),
          problemIds: selected,
          startAt: new Date(String(d.startAt)).toISOString(),
          published: true,
          integrityEnabled: true,
        });
      }}
    >
      <p className="eyebrow">БЛАНК СОРЕВНОВАНИЯ</p>
      <h2>Новый контест</h2>
      <h3 className="form-step">01 / Общее</h3>
      <label>
        Название
        <input name="title" required minLength={2} maxLength={120} />
      </label>
      <label>
        Краткое описание
        <textarea name="description" rows={2} maxLength={1000} />
      </label>
      <div className="form-columns">
        <label>
          Формат
          <select name="format">
            <option value="INDIVIDUAL">Личный зачёт</option>
            <option value="TEAM">Команда из двух</option>
          </select>
        </label>
        <label>
          Подсчёт
          <select name="scoring">
            <option value="ICPC">ICPC — задачи и штраф</option>
            <option value="IOI">IOI — частичные баллы</option>
          </select>
        </label>
      </div>
      <h3 className="form-step">02 / Задачи</h3>
      <fieldset>
        <legend className="sr-only">Выберите задачи</legend>
        {problems.map((p) => (
          <label className="check" key={p.id}>
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={(e) =>
                setSelected((ids) =>
                  e.target.checked
                    ? [...ids, p.id]
                    : ids.filter((id) => id !== p.id),
                )
              }
            />
            {p.title}
          </label>
        ))}
      </fieldset>
      <h3 className="form-step">03 / Время</h3>
      <div className="form-columns">
        <label>
          Начало (местное время)
          <input
            type="datetime-local"
            name="startAt"
            required
            defaultValue={new Date(
              Date.now() - new Date().getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16)}
          />
        </label>
        <label>
          Длительность, мин
          <input
            type="number"
            name="duration"
            defaultValue={60}
            min={1}
            max={300}
            required
          />
        </label>
      </div>
      <p className="muted">
        Запись решения включена. Участники подтвердят согласие перед
        регистрацией.
      </p>
      <button className="primary" disabled={busy || !selected.length}>
        {busy ? "Публикуем…" : "Опубликовать контест"}
      </button>
    </form>
  );
}
