"use client";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Notifications, toast } from "./notifications";
import { io } from "socket.io-client";
import {
  configureDisplayTZ, plural, remaining,
  api,
  useLoad,
  Loading,
  Failure,
  Title,
  Clock,
  Tag,
  date,
  time,
  status,
  Consent,
  Standings,
} from "./lib";
import {Board,ContestList,Login,Records} from "./live-screens";
import { Organizer } from "./organizer";
import { Replay } from "./replay";
const Arena = dynamic(() => import("./arena"), { loading: () => <Loading /> });
const query = new QueryClient();
export default function Application({displayTZ='Europe/Samara'}:{displayTZ?:string}) {
  configureDisplayTZ(displayTZ);
  return (
    <QueryClientProvider client={query}>
      <Suspense fallback={<Loading />}>
        <Shell />
      </Suspense>
    </QueryClientProvider>
  );
}
function Shell() {
  const path = usePathname(),
    router = useRouter();
  const [user, setUser] = useState<any>(undefined),
    [version, setVersion] = useState(0),
    [connected, setConnected] = useState(false);
  useEffect(() => {
    api("/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  useEffect(() => {
    if (!user) return;
    const socket = io({ transports: ["polling", "websocket"] });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("verdict", (v: any) => {
      if (!["RUNNING", "QUEUED"].includes(v.status))
        toast(`Решение проверено: ${v.status}`);
      setVersion((v) => v + 1);
    });
    return () => {
      socket.disconnect();
    };
  }, [user?.id]);
  const refresh = () => setVersion((v) => v + 1);
  const arena = /^\/(arena|matches\/[^/]+)/.test(path);
  const links = [
    ["/", "Табло"],
    ["/contests", "Контесты"],
    ["/duels", "Дуэли"],
    ["/teams", "Команды"],
    ["/records", user?.role === "ORGANIZER" ? "Видеоповторы" : "Мои записи"],
    ...(user?.role === "ORGANIZER" ? [["/org", "Судейская"]] : []),
  ];
  return (
    <div className={arena ? "app arena-theme" : "app"}>
      <a className="skip" href="#content">
        К содержимому
      </a>
      <header className="topbar">
        <Link href="/" className="wordmark">
          <i />
          ЧЕСТНЫЙ РАУНД
        </Link>
        <nav aria-label="Основная навигация">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="top-right">
          <span className="server-clock">
            <Clock />
          </span>
          <span className="connection">
            <i className={connected ? "online" : ""} />
            {connected ? "СВЯЗЬ" : "ОФЛАЙН"}
          </span>
          {user ? (
            <button
              className="user-button"
              title="Выйти из аккаунта"
              onClick={async () => {
                await api("/auth/logout", {});
                setUser(null);
                router.push("/login");
              }}
            >
              {user.name.split(" ")[0]} <span>↗</span>
            </button>
          ) : (
            <Link href="/login">Войти</Link>
          )}
        </div>
      </header>
      <main id="content" className={arena ? "main arena-main" : "main"}>
        {path === "/login" ? (
          <Login
            onLogin={(u: any) => {
              setUser(u);
              router.push(u.role === "ORGANIZER" ? "/org" : "/");
            }}
          />
        ) : user === undefined ? (
          <Loading />
        ) : path === "/" ? (
          <Board user={user} />
        ) : path === "/_design" ? (
          <Design />
        ) : path === "/contests" ? (
          <ContestList />
        ) : path.startsWith("/contests/") ? (
          <ContestPage id={path.split("/")[2]} user={user} version={version} />
        ) : !user ? (
          <NeedLogin />
        ) : path.startsWith("/org") ? (
          <Organizer user={user} refresh={refresh} version={version} />
        ) : path.startsWith("/arena/") ? (
          <Arena id={path.split("/")[2]} user={user} />
        ) : path === "/duels" ? (
          <Duels />
        ) : path.startsWith("/matches/") ? (
          <MatchPage id={path.split("/")[2]} user={user} />
        ) : path === "/teams" ? (
          <Teams />
        ) : path.startsWith("/invite/") ? (
          <Invitation token={path.split("/")[2]} user={user} />
        ) : path === "/records" ? (
          <Records version={version} />
        ) : path.startsWith("/replay/") ? (
          <Replay
            contextId={path.split("/")[2]}
            userId={path.split("/")[3]}
            user={user}
          />
        ) : (
          <Failure text="Страница не найдена" />
        )}
      </main>
      {!arena && (
        <footer className="footer">
          <span>
            ЧЕСТНЫЙ РАУНД{" "}
            <span className="muted">/ соревнования по программированию</span>
          </span>
          <Link href="/records">Прозрачность результата</Link>
          <span className="mono">ФСП × ПОЛИТЕХ · 2026</span>
        </footer>
      )}
      <Notifications />
    </div>
  );
}
function NeedLogin() {
  return (
    <section className="narrow">
      <Title section="ДОСТУП" title="Войдите, чтобы продолжить" />
      <p>Выберите демо-аккаунт или войдите по email.</p>
      <Link className="button primary" href="/login">
        Перейти ко входу
      </Link>
    </section>
  );
}
function ContestPage({
  id,
  user,
  version,
}: {
  id: string;
  user: any;
  version: number;
}) {
  const router = useRouter();
  const [v, setV] = useState(0),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(""),
    [teamId, setTeamId] = useState("");
  const { data: c, error: loadError } = useLoad("/contests/" + id, version + v);
  const { data: teams } = useLoad("/teams");
  const { data: rows } = useLoad("/contexts/" + id + "/standings", version + v);
  useEffect(() => {
    if (!user) return;
    const s = io();
    s.on("connect", () => s.emit("join", id));
    s.on("refresh", () => setV((v) => v + 1));
    const t = setInterval(() => setV((v) => v + 1), 5000);
    return () => {
      s.disconnect();
      clearInterval(t);
    };
  }, [id, user?.id]);
  if (loadError) return <Failure text={loadError} />;
  if (!c) return <Loading />;
  async function register() {
    try {
      await api(`/contests/${id}/register`, { teamId });
      setV((v) => v + 1);
      setConsent(false);
      toast("Вы записаны на соревнование");
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <>
      <Title
        section={c.format === "TEAM" ? "КОМАНДНЫЙ ЗАЧЁТ" : "ЛИЧНЫЙ ЗАЧЁТ"}
        title={c.title}
      >
        <Tag live={status(c) === "Идёт"}>{status(c)}</Tag>
      </Title>
      <p className="intro">{c.description}</p>
      <div className="contest-details">
        <span>
          <b>{c.problems.length}</b> {plural(c.problems.length,"задача","задачи","задач")}
        </span>
        <span>
          <b>{c.duration>=1440?Math.floor(c.duration/1440):c.duration}</b> {c.duration>=1440?plural(Math.floor(c.duration/1440),"день","дня","дней"):plural(c.duration,"минута","минуты","минут")}
        </span>
        <span>
          <b>{c.scoring}</b> зачёт
        </span>
        <span>
          <b>{c.entries}</b> {plural(c.entries,"участник","участника","участников")}
        </span>
        <span>
          <b>{time(c.startAt)}</b> {date(c.startAt)}
        </span>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {consent ? (
        <Consent
          id={id}
          onDone={() => {
            setConsent(false);
            if (c.format === "TEAM")
              toast(
                "Согласие сохранено. Напарник тоже должен подтвердить его.",
              );
            else register();
          }}
        />
      ) : (
        <div className="contest-actions">
          {!user ? (
            <Link className="button primary" href="/login">
              Войти и записаться
            </Link>
          ) : user.role === "ORGANIZER" ? (
            <Link className="button" href="/records">
              Проверить записи
            </Link>
          ) : c.entry ? (
            <>
              <Tag>Вы записаны</Tag>
              {status(c) === "Идёт" && (
                <button
                  className="primary"
                  onClick={() => router.push("/arena/" + id)}
                >
                  Войти на арену
                </button>
              )}
            </>
          ) : (
            status(c) !== "Завершён" && (
              <>
                <button className="primary" onClick={() => setConsent(true)}>
                  Согласие на запись
                </button>
                {c.format === "TEAM" && (
                  <>
                    <label>
                      Команда
                      <select
                        aria-label="Ваша команда"
                        value={teamId}
                        onChange={(e) => setTeamId(e.target.value)}
                      >
                        <option value="">Выберите команду</option>
                        {teams?.map((t: any) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button onClick={register}>Записать команду</button>
                  </>
                )}
              </>
            )
          )}
        </div>
      )}
      <div className="section-heading separated">
        <h2>Задачи раунда</h2>
        <span className="muted">Условия откроются на арене после старта</span>
      </div>
      {c.problems.map((p: any, i: number) => (
        <div key={p.id} className="problem-row">
          <span className="problem-letter">{String.fromCharCode(65 + i)}</span>
          <h3>{p.title}</h3>
          <span className="mono muted">
            {p.timeMs} мс / {p.memoryMb} МБ
          </span>
        </div>
      ))}
      <div className="section-heading separated">
        <h2>Протокол</h2>
        <span className="mono">
          {c.scoring === "IOI" ? "Лучший балл по задаче" : "Задачи ↓ · штраф ↑"}
        </span>
      </div>
      {rows ? (
        <Standings rows={rows} problems={c.problems} mode={c.scoring} />
      ) : (
        <p className="muted">
          Протокол доступен участникам и организатору после входа.
        </p>
      )}
    </>
  );
}
function Duels() {
  const router = useRouter();
  const { data: matches } = useLoad("/matches"),
    { data: problems } = useLoad("/problems");
  const [duration, setDuration] = useState(20),
    [selected, setSelected] = useState<string[]>(["sum", "max", "brackets"]),
    [error, setError] = useState("");
  return (
    <>
      <Title section="ОДИН НА ОДИН" title="Дуэли" />
      <div className="duels-layout">
        <section>
          <div className="section-heading">
            <h2>Ваши матчи</h2>
          </div>
          {!matches ? (
            <Loading />
          ) : matches.length ? (
            matches.map((m: any) => (
              <Link className="match-row" href={"/matches/" + m.id} key={m.id}>
                <span>{m.host}</span>
                <strong>vs</strong>
                <span>{m.guest || "Ждём соперника"}</span>
                <Tag>
                  {m.endsAt && Date.now() > +new Date(m.endsAt)
                    ? "Завершена"
                    : m.startAt
                      ? "На арене"
                      : "Лобби"}
                </Tag>
              </Link>
            ))
          ) : (
            <p className="empty">
              Дуэлей пока нет. Создайте вызов — ссылка появится сразу.
            </p>
          )}
        </section>
        <form
          className="form-sheet"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const m = await api("/matches", {
                duration,
                problemIds: selected,
              });
              router.push("/matches/" + m.id);
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          <p className="eyebrow">НОВЫЙ ВЫЗОВ</p>
          <h2>Назначьте условия</h2>
          <label>
            Длительность
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {[10, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n} минут
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Задачи (не более трёх)</legend>
            {problems
              ?.filter((p: any) => p.duelPool)
              .map((p: any) => (
                <label className="check" key={p.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={(e) =>
                      setSelected((ids) =>
                        e.target.checked
                          ? [...ids, p.id].slice(-3)
                          : ids.filter((id) => id !== p.id),
                      )
                    }
                  />
                  {p.title}
                </label>
              ))}
          </fieldset>
          <p className="muted">
            Побеждает тот, кто решит больше. При равенстве — меньше штраф. При
            нуле решённых — ничья.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={!selected.length}>
            Создать дуэль
          </button>
        </form>
      </div>
    </>
  );
}
function Invitation({ token, user }: { token: string; user: any }) {
  const { data, error } = useLoad("/invite/" + token);
  const [actionError, setError] = useState("");
  const router = useRouter();
  if (error) return <Failure text={error} />;
  if (!data) return <Loading />;
  return (
    <section className="invitation">
      <p className="eyebrow">
        {data.type === "match" ? "ВЫЗОВ НА ДУЭЛЬ" : "ПРИГЛАШЕНИЕ В КОМАНДУ"}
      </p>
      <h1>{data.title}</h1>
      <div className="ticket-rule" />
      <p className="intro">
        {data.type === "match"
          ? `${data.count} ${plural(data.count,"задача","задачи","задач")} · ${data.duration} ${plural(data.duration,"минута","минуты","минут")}`
          : "Два участника. Общий результат."}
      </p>
      <p>Только ваш код, время и решение.</p>
      {actionError && (
        <p className="error" role="alert">
          {actionError}
        </p>
      )}
      {user ? (
        <button
          className="primary"
          onClick={async () => {
            try {
              const d = await api("/invite/" + token + "/accept", {});
              router.push(d.type === "match" ? "/matches/" + d.id : "/teams");
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          {data.type === "match" ? "Принять вызов" : "Присоединиться"}
        </button>
      ) : (
        <Link className="button primary" href="/login">
          Войти и принять
        </Link>
      )}
    </section>
  );
}
function MatchPage({ id, user }: { id: string; user: any }) {
  const [v, setV] = useState(0),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState("");
  const { data: m, error: loadError } = useLoad("/matches/" + id, v);
  useEffect(() => {
    const s = io();
    s.on("connect", () => s.emit("join", id));
    s.on("refresh", () => setV((v) => v + 1));
    const t = setInterval(() => setV((v) => v + 1), 3000);
    return () => {
      s.disconnect();
      clearInterval(t);
    };
  }, [id]);
  if (loadError) return <Failure text={loadError} />;
  if (!m) return <Loading />;
  const host = m.people.find((p: any) => p.id === m.hostId),
    guest = m.people.find((p: any) => p.id === m.guestId);
  if (m.startAt && !m.finished) return <Arena id={id} user={user} match={m} />;
  const winner =
    m.winner === "a" ? host?.name : m.winner === "b" ? guest?.name : "Ничья";
  return (
    <>
      <Title
        section={m.finished ? "ПРОТОКОЛ ДУЭЛИ" : "ЛОББИ"}
        title={m.finished ? winner : "Дождитесь сигнала"}
      />
      <div className="match-score">
        <div>
          <h2>{host?.name}</h2>
          <span className="mono">{host?.rating} ELO</span>
        </div>
        <strong>
          {m.finished
            ? (m.standings.find((r: any) => r.id === m.hostId)?.solved || 0) +
              " : " +
              (m.standings.find((r: any) => r.id === m.guestId)?.solved || 0)
            : "vs"}
        </strong>
        <div>
          <h2>{guest?.name || "Место соперника"}</h2>
          <span className="mono">
            {guest?.rating ? guest.rating + " ELO" : "ПО ССЫЛКЕ"}
          </span>
        </div>
      </div>
      {m.finished ? (
        <>
          <Standings
            rows={m.standings}
            problems={m.problemIds.map((id: string) => ({ id }))}
          />
          <p className="protocol-hash">Протокол заверен: sha256 {m.protocol}</p>
          <Link className="button" href="/duels">
            Создать новую дуэль
          </Link>
        </>
      ) : (
        <>
          <div className="invite-link">
            <label>
              Ссылка сопернику
              <input
                readOnly
                value={
                  typeof location !== "undefined"
                    ? location.origin + "/invite/" + m.token
                    : ""
                }
              />
            </label>
            <button
              onClick={() =>
                navigator.clipboard
                  .writeText(location.origin + "/invite/" + m.token)
                  .then(() => toast("Ссылка скопирована"))
                  .catch(() => toast("Выделите ссылку и скопируйте её вручную"))
              }
            >
              Скопировать
            </button>
          </div>
          <p className="muted">
            {m.problemIds.length} {plural(m.problemIds.length,"задача","задачи","задач")} / {m.duration} мин. Когда оба готовы,
            начнётся отсчёт.
          </p>
          {!accepted ? (
            <Consent id={id} onDone={() => setAccepted(true)} />
          ) : (
            <button
              className="primary"
              disabled={!m.guestId || m.readyIds.includes(user.id)}
              onClick={async () => {
                try {
                  await api("/matches/" + id + "/ready", {});
                  setV((v) => v + 1);
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              {m.readyIds.includes(user.id)
                ? "Вы готовы. Ждём соперника"
                : "Готов к раунду"}
            </button>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </>
  );
}
function Teams() {
  const { data: teams, setData, error } = useLoad("/teams");
  const [name, setName] = useState(""),
    [actionError, setError] = useState("");
  return (
    <>
      <Title section="ПАРНЫЙ ЗАЧЁТ" title="Команды из двух" />
      <div className="duels-layout">
        <section>
          {error && <Failure text={error} />}
          <div className="section-heading">
            <h2>Ваш состав</h2>
          </div>
          {!teams ? (
            <Loading />
          ) : teams.length ? (
            teams.map((t: any) => (
              <section className="team-sheet" key={t.id}>
                <h2>{t.name}</h2>
                {t.members.map((m: any, i: number) => (
                  <div className="team-member" key={m.id}>
                    <span className="mono">0{i + 1}</span>
                    <strong>{m.name}</strong>
                    <span className="muted">
                      {t.captainId === m.id ? "Капитан" : "Напарник"}
                    </span>
                  </div>
                ))}
                {t.memberIds.length === 1 && (
                  <div className="invite-link">
                    <label>
                      Пригласите напарника
                      <input
                        readOnly
                        value={location.origin + "/invite/" + t.token}
                      />
                    </label>
                    <button
                      onClick={() =>
                        navigator.clipboard
                          .writeText(location.origin + "/invite/" + t.token)
                          .then(() => toast("Ссылка скопирована"))
                      }
                    >
                      Скопировать
                    </button>
                  </div>
                )}
                <Link href="/contests/pairs" className="button">
                  Перейти к парному зачёту
                </Link>
              </section>
            ))
          ) : (
            <p className="empty">
              Состава пока нет. Создайте команду и пригласите напарника.
            </p>
          )}
        </section>
        <form
          className="form-sheet"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/teams", { name });
              setData(await api("/teams"));
              setName("");
              toast("Команда создана");
            } catch (e: any) {
              setError(e.message);
            }
          }}
        >
          <p className="eyebrow">НОВЫЙ СОСТАВ</p>
          <h2>Начните с названия</h2>
          <label>
            Название команды
            <input
              required
              minLength={2}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="muted">
            Вы станете капитаном. Второй участник присоединится по ссылке.
          </p>
          {actionError && (
            <p className="error" role="alert">
              {actionError}
            </p>
          )}
          <button className="primary">Создать команду</button>
        </form>
      </div>
    </>
  );
}
function Design() {
  return (
    <>
      <Title section="СИСТЕМА ИНТЕРФЕЙСА" title="Судейский протокол" />
      <div className="design-samples">
        <h2>Бумага, чернила, сигнал.</h2>
        <p>
          IBM Plex Sans · IBM Plex Sans Condensed ·{" "}
          <span className="mono">IBM Plex Mono 0123456789</span>
        </p>
        <button className="primary">Главное действие</button>
        <button>Вторичное действие</button>
        <input aria-label="Пример поля" placeholder="Поле протокола" />
        <div className="section-heading">
          <Tag live>Идёт</Tag>
          <Tag>Завершён</Tag>
          <span className="ok mono">OK · Верно</span>
          <span className="wa mono">WA · Неверный ответ</span>
        </div>
        <Loading />
        <Failure text="Пример ошибки. Действие не выполнено." />
        <div className="arena-theme design-arena">
          <h2>Поле соревнования</h2>
          <Clock endsAt={new Date(Date.now() + 1200000).toISOString()} />
          <p className="mono">a, b = map(int, input().split())</p>
        </div>
      </div>
    </>
  );
}
