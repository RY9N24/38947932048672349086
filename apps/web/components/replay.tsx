"use client";
import { useEffect, useState } from "react";
import { plural, api, useLoad, Title, Failure, Loading, time } from "./lib";
import { toast } from "./notifications";
import {ReplayTimeline} from "./replay-timeline";
import Link from "next/link";
export function Replay({
  contextId,
  userId,
  user,
}: {
  contextId: string;
  userId: string;
  user: any;
}) {
  const [v, setV] = useState(0),
    { data, error } = useLoad("/integrity/" + contextId + "/" + userId, v);
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(4),
    [comment, setComment] = useState(""),
    [decision, setDecision] = useState("UNREVIEWED");
  const [skipPauses,setSkipPauses]=useState(true);
  const [selectedSession, setSelectedSession] = useState("");
  const events =
    data?.events?.filter(
      (e: any) => !selectedSession || e.sessionId === selectedSession,
    ) || [];
  useEffect(() => {
    if (!playing || !data) return;
    if(index>=events.length-1){setPlaying(false);return;}
    const gap=+new Date(events[index+1].createdAt)-+new Date(events[index].createdAt);
    const t=setTimeout(()=>setIndex(i=>i+1),Math.max(40,(skipPauses?Math.min(gap,3000):gap)/speed));
    return()=>clearTimeout(t);
  },[playing,speed,data,selectedSession,index,skipPauses]);
  useEffect(()=>{setDecision(data?.reviews?.[0]?.decision||'UNREVIEWED');},[data?.reviews?.[0]?.id]);
  if (error) return <Failure text={error} />;
  if (!data) return <Loading />;
  const event = events[index];
  const current = event?.payload;
  const start = events.length ? +new Date(events[0].createdAt) : 0,
    end = events.length ? +new Date(events.at(-1).createdAt) : 0;
  return (
    <>
      <Title section="ВИДЕОПОВТОР / СУДЕЙСКАЯ ЗАПИСЬ" title={data.user.name}>
        <span
          className={
            "risk " +
            (data.risk >= 20 ? "high" : data.risk >= 5 ? "medium" : "low")
          }
        >
          {data.risk}
        </span>
      </Title>
      <p className="intro">
        {contextId === "qualifier"
          ? "Демо-сценарий: синтетическая история решения, не реальное нарушение."
          : "Восстановление кода по событиям редактора. Сигналы требуют проверки человеком."}
      </p>
      <div className="replay-layout">
        <section>
          <label className="record-task-label">
            Запись задачи
            <select
              aria-label="Запись задачи"
              value={selectedSession}
              onChange={(e) => {
                setSelectedSession(e.target.value);
                setIndex(0);
                setPlaying(false);
              }}
            >
              <option value="">Все задачи</option>
              {data.sessions.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <div className="replay-code">
            <div className="editor-bar">
              <span className="mono">
                КОД НА МОМЕНТ {event ? time(event.createdAt) : "—"}
              </span>
              <span className="mono">
                {index + 1} / {events.length}
              </span>
            </div>
            <pre className={event?.type==="paste"?"paste-highlight":""}>{current?.code || "# В этот момент код ещё не появился"}</pre>
          </div>
          <div className="player">
            <button
              aria-label={
                playing ? "Приостановить повтор" : "Воспроизвести повтор"
              }
              onClick={() => {
                if (index >= events.length - 1) setIndex(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "Ⅱ Пауза" : "▶ Воспроизвести"}
            </button>
            <label className="sr-only" htmlFor="replay-position">
              Момент записи
            </label>
            <input
              id="replay-position"
              type="range"
              min={0}
              max={Math.max(0, events.length - 1)}
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
            />
            <label className="sr-only" htmlFor="replay-speed">
              Скорость повтора
            </label>
            <select
              id="replay-speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              {[1, 4, 16, 64].map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </div>
          <label className="check replay-skip"><input type="checkbox" checked={skipPauses} onChange={e=>setSkipPauses(e.target.checked)}/>Пропускать паузы</label>
          <ReplayTimeline data={data} events={events} index={index} onSeek={(session,i)=>{setSelectedSession(session);setIndex(i);setPlaying(false);}}/>
          <button
            onClick={async () => {
              try {
                const r = await api(
                  `/integrity/${contextId}/${userId}/verify`,
                  {},
                );
                toast(
                  r.valid
                    ? `Цепочка цела: ${r.count} ${plural(r.count,"событие","события","событий")}. Подмена не обнаружена.`
                    : "Целостность записи нарушена",
                );
              } catch (e: any) {
                toast(e.message);
              }
            }}
          >
            Проверить целостность записи
          </button>
          <p className="muted">
            Цепочка подтверждает сохранность принятых сервером событий. Она не
            доказывает самостоятельность решения.
          </p>

          {data.comparisons?.length > 0 && (
            <section className="comparison-section">
              <div className="section-heading">
                <h2>Похожие решения</h2>
              </div>
              <p className="muted">
                Сравниваем нормализованные токены. Похожие короткие алгоритмы
                могут совпадать независимо.
              </p>
              {data.comparisons.map((c: any) => (
                <details
                  key={c.userId + ":" + c.problemId}
                  className="comparison"
                >
                  <summary>
                    {c.name} · {Math.round(c.ratio * 100)}% сходства
                  </summary>
                  <p>Раньше отправил: {c.first}</p>
                  <div className="code-comparison">
                    <div>
                      <h3>{data.user.name}</h3>
                      <pre>{c.code}</pre>
                    </div>
                    <div>
                      <h3>{c.name}</h3>
                      <pre>{c.otherCode}</pre>
                    </div>
                  </div>
                  <Link
                    className="button"
                    href={"/replay/" + contextId + "/" + c.userId}
                  >
                    Открыть запись второго участника
                  </Link>
                </details>
              ))}
            </section>
          )}
          {data.contributions?.length > 0 && (
            <section className="contributions">
              <div className="section-heading">
                <h2>Вклад в команду</h2>
              </div>
              <div className="table-scroll">
                <table className="standings">
                  <thead>
                    <tr>
                      <th>Участник</th>
                      <th>Отправки</th>
                      <th>OK</th>
                      <th>Символы в черновиках</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.contributions.map((c: any) => (
                      <tr key={c.name}>
                        <th>{c.name}</th>
                        <td>{c.attempts}</td>
                        <td>{c.accepted}</td>
                        <td>{c.characters}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">
                Число символов показывает объём текущих черновиков. Это не
                атрибуция авторства итогового решения.
              </p>
            </section>
          )}
        </section>
        <aside className="review-journal">
          <div className="section-heading">
            <h2>Журнал сигналов</h2>
            <span className="mono">{data.flags.length}</span>
          </div>
          {data.flags.length ? (
            data.flags.map((f: any) => (
              <section className={"flag " + f.level} key={f.id}>
                <span className="mono">
                  {time(f.createdAt)} /{" "}
                  {f.level === "critical"
                    ? "ВЫСОКИЙ"
                    : f.level === "warning"
                      ? "ВНИМАНИЕ"
                      : "КОНТЕКСТ"}
                </span>
                <h3>
                  {(
                    {
                      EXTERNAL_PASTE: "Внешняя вставка",
                      AWAY_THEN_SOLVE: "Возвращение и решение",
                      INHUMAN_TYPING: "Скорость набора",
                      NO_RECORDING: "Нет записи",
                      CODE_NOT_FROM_EDITOR: "Код отличается",
                      SIMILAR_CODE: "Похожие решения",
                      LONG_AWAY: "Вне вкладки",
                    } as Record<string, string>
                  )[f.type] || f.type}
                </h3>
                <p>{f.explanation}</p>
                <button
                  className="text-button"
                  onClick={() => {
                    setSelectedSession("");
                    const allEvents = data.events;
                    const exact = allEvents.findIndex(
                      (e: any) => e.id === f.eventId,
                    );
                    setIndex(
                      exact >= 0
                        ? exact
                        : Math.max(
                            0,
                            data.events.findIndex(
                              (e: any) =>
                                +new Date(e.createdAt) >=
                                +new Date(f.createdAt),
                            ),
                          ),
                    );
                  }}
                >
                  К моменту
                </button>
              </section>
            ))
          ) : (
            <p className="empty">
              Сигналов нет. Это не заменяет ручную проверку.
            </p>
          )}
          {user.role === "ORGANIZER" && (
            <form
              className="review-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  decision === "DISQUALIFIED" &&
                  !confirm(
                    "Дисквалифицировать участника? Результат будет исключён из протокола.",
                  )
                )
                  return;
                try {
                  await api(`/integrity/${contextId}/${userId}/review`, {
                    decision,
                    comment,
                  });
                  toast("Решение организатора сохранено");
                  setV((v) => v + 1);
                } catch (e: any) {
                  toast(e.message);
                }
              }}
            >
              <h3>Решение организатора</h3>
              <label>
                Статус
                <select
                  aria-label="Статус"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                >
                  <option value="UNREVIEWED">Не проверен</option>
                  <option value="CLEAN">Нарушений не обнаружено</option>
                  <option value="SUSPICIOUS">Требуется разбор</option>
                  <option value="DISQUALIFIED">Дисквалифицировать</option>
                </select>
              </label>
              <label>
                Комментарий
                <textarea
                  aria-label="Комментарий"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required={decision === "DISQUALIFIED"}
                  minLength={decision === "DISQUALIFIED" ? 5 : 0}
                  rows={3}
                />
              </label>
              <button className="primary">Зафиксировать решение</button>
            </form>
          )}
          {data.reviews.map((r: any) => (
            <div className="review-history" key={r.id}>
              <span className="mono">{time(r.createdAt)}</span>
              <p>
                {r.decision === "UNREVIEWED" ? "Не проверен" : r.decision === "CLEAN"
                  ? "Нарушений не обнаружено"
                  : r.decision === "SUSPICIOUS"
                    ? "Требуется разбор"
                    : "Дисквалифицирован"}
                {r.comment && ": " + r.comment}
              </p>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
