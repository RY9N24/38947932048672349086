"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
export async function api(path: string, data?: unknown, method = "POST") {
  const res = await fetch("/api" + path, {
    credentials: "include",
    ...(data === undefined
      ? {}
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }),
  });
  const result = await res
    .json()
    .catch(() => ({ message: "Сервер не ответил. Повторите действие." }));
  if (!res.ok) throw Error(result.message || "Не удалось выполнить действие");
  return result;
}
export function useLoad(path: string, version = 0) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    api(path)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return { data, error, setData };
}
export function Loading() {
  return (
    <div className="loading" aria-label="Загрузка" role="status">
      <i />
      <i />
      <i />
      <span>Загружаем протокол…</span>
    </div>
  );
}
export function Failure({ text }: { text: string }) {
  return (
    <div className="error" role="alert">
      {text} <button onClick={() => location.reload()}>Повторить</button>
    </div>
  );
}
export {plural} from '../../../packages/shared/locale';
let displayTZ='Europe/Samara';
export function configureDisplayTZ(value:string){try{new Intl.DateTimeFormat('ru-RU',{timeZone:value});displayTZ=value;}catch{displayTZ='Europe/Samara';}}
export const zoneLabel=()=>displayTZ==='Europe/Samara'?'САМ':displayTZ==='Europe/Moscow'?'МСК':displayTZ;
export const date=(v:string)=>new Intl.DateTimeFormat('ru-RU',{timeZone:displayTZ,day:'2-digit',month:'short',year:'numeric'}).format(new Date(v));
export const time=(v:string)=>new Intl.DateTimeFormat('ru-RU',{timeZone:displayTZ,hour:'2-digit',minute:'2-digit'}).format(new Date(v));
export function remaining(c:any){const seconds=Math.max(0,Math.ceil((+new Date(c.startAt)+(Date.now()<+new Date(c.startAt)?0:c.duration*60000)-Date.now())/1000));const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60);return (Date.now()<+new Date(c.startAt)?'Через ':'Осталось ')+(days?`${days} д ${hours} ч`:hours?`${hours} ч ${minutes} мин`:`${minutes} мин`);}
export function status(c: any) {
  if (!c.published) return "Черновик";
  if (Date.now() < +new Date(c.startAt)) return "Регистрация";
  return Date.now() < +new Date(c.startAt) + c.duration * 60000
    ? "Идёт"
    : "Завершён";
}
export const verdict: Record<string, string> = {
  QUEUED: "В очереди",
  RUNNING: "Проверяется",
  OK: "OK · Верно",
  WA: "WA · Неверный ответ",
  TLE: "TLE · Время вышло",
  MLE: "MLE · Лимит памяти",
  RE: "RE · Ошибка выполнения",
  CE: "CE · Ошибка компиляции",
  SE: "SE · Ошибка среды",
};
export function Tag({
  children,
  live = false,
}: {
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <span className={"tag" + (live ? " live" : "")}>
      {live && <i />}
      {children}
    </span>
  );
}
export function Title({
  section,
  title,
  children,
}: {
  section: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{section}</p>
        <h1>{title}</h1>
      </div>
      {children && <div className="title-action">{children}</div>}
    </div>
  );
}
export function Clock({ endsAt }: { endsAt?: string }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let offset = 0,
      active = true;
    const sync = async () => {
      const before = Date.now();
      try {
        const d = await api("/health");
        if (active) {
          offset = +new Date(d.time) + (Date.now() - before) / 2 - Date.now();
          setNow(Date.now() + offset);
        }
      } catch {
        if (active) setNow(Date.now() + offset);
      }
    };
    sync();
    const t = setInterval(() => setNow(Date.now() + offset), 1000),
      s = setInterval(sync, 60000);
    return () => {
      active = false;
      clearInterval(t);
      clearInterval(s);
    };
  }, []);
  const left = Math.max(
    0,
    Math.ceil(((endsAt ? +new Date(endsAt) : now) - now) / 1000),
  );
  return (
    <time className={"clock" + (endsAt && left < 60 ? " urgent" : "")}>
      {!now
        ? "--:--:--"
        : endsAt
          ? `${Math.floor(left / 60)
              .toString()
              .padStart(2, "0")}:${(left % 60).toString().padStart(2, "0")}`
          : new Intl.DateTimeFormat('ru-RU',{timeZone:displayTZ,hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(now))+' '+zoneLabel()}
    </time>
  );
}
export function Consent({ id, onDone }: { id: string; onDone: () => void }) {
  const [yes, setYes] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <section className="consent">
      <p className="eyebrow">ПРАВИЛА УЧАСТИЯ</p>
      <h2>Записываем путь к решению</h2>
      <p>
        Сохраняем изменения кода, вставки в редактор, отправки и время вне
        вкладки. Это помогает организатору разбирать спорные результаты.
      </p>
      <div className="privacy-columns">
        <div>
          <h3>В записи</h3>
          <p>Только действия на платформе. Повтор видите вы и организатор.</p>
        </div>
        <div>
          <h3>За пределами записи</h3>
          <p>
            Камера, микрофон, экран, другие сайты и буфер обмена вне редактора.
          </p>
        </div>
      </div>
      <p className="muted">
        Срок хранения — 30 дней после соревнования. Сигнал не означает
        нарушение: решение принимает человек.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={yes}
          onChange={(e) => setYes(e.target.checked)}
        />
        Понятно, участвую
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        className="primary"
        disabled={!yes || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/contexts/${id}/consent`, { accepted: true });
            onDone();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Подтвердить согласие
      </button>
    </section>
  );
}
export function Standings({
  rows,
  problems,
  mode = "ICPC",
}: {
  rows: any[];
  problems: any[];
  mode?: string;
}) {
  const table=useRef<HTMLDivElement>(null),positions=useRef(new Map<string,number>());
  useLayoutEffect(()=>{if(!table.current)return;const next=new Map<string,number>();for(const row of table.current.querySelectorAll<HTMLTableRowElement>('tbody tr')){const id=row.dataset.entry!,top=row.getBoundingClientRect().top;next.set(id,top);const old=positions.current.get(id);if(old!==undefined&&Math.abs(old-top)>1&&!matchMedia('(prefers-reduced-motion: reduce)').matches)row.animate([{transform:`translateY(${old-top}px)`,background:'#ff4d0020'},{transform:'translateY(0)',background:'transparent'}],{duration:450,easing:'ease-out'});}positions.current=next;},[rows]);
  return (
    <div className="table-scroll" ref={table}>
      <table className="standings">
        <caption className="sr-only">Таблица результатов соревнования</caption>
        <thead>
          <tr>
            <th>Место</th>
            <th>Участник / команда</th>
            {problems.map((p, i) => (
              <th key={p.id}>{String.fromCharCode(65 + i)}</th>
            ))}
            <th>{mode === "IOI" ? "Баллы" : "Решено"}</th>
            <th>Штраф</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-entry={row.id} className={row.disqualified ? "disqualified" : ""}>
              <td className="place">{row.place.toString().padStart(2, "0")}</td>
              <th scope="row">
                {row.name}
                {row.disqualified && <small>Дисквалифицирован</small>}
              </th>
              {row.cells.map((c: any) => (
                <td
                  key={c.problemId}
                  className={(c.solved ? "ok" : c.failures ? "wa" : "")+(c.first?' first-solve':'')}
                >
                  <b>
                    {mode === "IOI"
                      ? c.points
                      : c.solved
                        ? "+" + (c.failures || "")
                        : c.pending
                          ? "…"
                          : c.failures
                            ? "−" + c.failures
                            : "·"}
                  </b>
                  <small>{c.solved ? c.minutes + " мин" : ""}</small>
                </td>
              ))}
              <td className="mono">
                {mode === "IOI" ? row.points : row.solved}
              </td>
              <td className="mono">{row.penalty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="empty">
          Результатов пока нет. После первой отправки здесь появится протокол.
        </p>
      )}
    </div>
  );
}
