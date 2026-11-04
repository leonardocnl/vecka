"use client";

import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import {
    Fragment,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type FormEvent,
    type PointerEvent as ReactPointerEvent,
} from "react";
import {
    addDays,
    clockIn,
    DAY_ABBR,
    DAY_FULL,
    DAY_NAMES,
    DAY_SHORT,
    daysBetween,
    daysText,
    dialLine,
    fullDate,
    hasHistoryOn,
    hasPendingOn,
    historyFor,
    isDone,
    isLate,
    monthGrid,
    monthRange,
    MONTHS,
    movableFor,
    NOTE_MAX,
    pad2,
    pendingDaysIn,
    recurrenceTag,
    swapPositions,
    tasksFor,
    TEXT_MAX,
    todayIn,
    toggleIn,
    weekday,
    type HistoryTask,
    type Task,
} from "@/domain/tasks";
import * as actions from "@/app/_actions/tasks";
import { signOut } from "@/app/_auth/actions";
import { Wordmark } from "./Wordmark";
import { dialSteps, resist, swipeClick, swipeDown, swipeEnd, swipeMove, taskSwipe } from "./swipe";
import {
    measure,
    measureClosed,
    panelOffsets,
    playFlip,
    reducedMotion,
    settled,
    stopFlip,
    type Snapshot,
} from "./motion";
import {
    applyFontStep,
    applyTheme,
    FONT_STEPS,
    useFontStep,
    useThemeChoice,
    type ThemeChoice,
} from "./appearance";

const cx = (...names: (string | false | null)[]) => names.filter(Boolean).join(" ");

// A semana no visual Rádio III (docs/design.md): dial com os 7 dias, card do dia com placas de
// virar, tarefa aberta no próprio card, edição numa folha de baixo, calendário e ajustes.
// Atualização otimista: a tela muda na hora; se o servidor recusar, avisa e recarrega.

const UNDO_MS = 6000;
const SAVE_ERROR = "Não foi possível salvar a última alteração. A lista foi recarregada.";
const LOAD_ERROR = "Sem conexão com o servidor. Tente de novo em instantes.";

type View = "week" | "calendar" | "day";
type Pick = { h: number | null; m: number | null; night: boolean; fine: boolean };
type PendingDelete = { task: Task; index: number; timer: ReturnType<typeof setTimeout> };
/** A folha de baixo: nova tarefa (no dia mostrado) ou edição de uma tarefa. */
type Sheet = { mode: "new" } | { mode: "edit"; task: Task };

const noPick: Pick = { h: null, m: null, night: false, fine: false };
const pickFrom = (time: string | null): Pick =>
    time
        ? {
              h: Number(time.slice(0, 2)),
              m: Number(time.slice(3, 5)),
              night: Number(time.slice(0, 2)) < 6,
              fine: Number(time.slice(3, 5)) % 15 !== 0,
          }
        : noPick;

const THEMES: { value: ThemeChoice; label: string }[] = [
    { value: "auto", label: "Auto" },
    { value: "light", label: "Claro" },
    { value: "dark", label: "Escuro" },
];

function NoteIcon() {
    return (
        <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
        >
            <path d="M3 2h7l3 3v9H3z" />
            <path d="M5.5 8h5M5.5 11h5" />
        </svg>
    );
}

const Cross = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.5 5L18.5 19M18.5 5.5L5.5 18.5" />
    </svg>
);
const ChevronLeft = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
    </svg>
);
const ChevronRight = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5l7 7-7 7" />
    </svg>
);
const CalendarIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15" rx="3" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
);
const PlusIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
    </svg>
);

/** Régua do dial: marcação principal no centro de cada dia, menores entre eles. */
export function DialScale({ sel }: { sel: number | null }) {
    return (
        <div className="dial-scale" aria-hidden="true">
            <svg viewBox="0 0 338 30" preserveAspectRatio="none">
                <path className="tick-base" d="M0 16H338" vectorEffect="non-scaling-stroke" />
                <path
                    className="tick-major"
                    d="M24.1 8V24M72.4 8V24M120.7 8V24M169 8V24M217.3 8V24M265.6 8V24M313.9 8V24"
                    vectorEffect="non-scaling-stroke"
                />
                <path
                    className="tick-minor"
                    d="M48.3 12V20M96.6 12V20M144.9 12V20M193.1 12V20M241.4 12V20M289.7 12V20M12 13V19M36 13V19M60 13V19M84 13V19M108 13V19M132 13V19M157 13V19M181 13V19M205 13V19M229 13V19M253 13V19M277 13V19M301 13V19M326 13V19"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>
            {sel !== null && <span className="needle" style={{ "--sel": sel } as CSSProperties} />}
        </div>
    );
}

/**
 * Uma placa de virar (split-flap): metade de cima e metade de baixo, com a linha do meio sempre à
 * vista. Ao trocar, a metade de cima do algarismo antigo gira para baixo e a de baixo do novo cai
 * e assenta (só CSS, ver globals.css). Se o valor muda de novo no meio, a virada anterior termina
 * na hora e a nova começa do algarismo que estava chegando.
 */
function FlapDigit({ digit }: { digit: string }) {
    const [shown, setShown] = useState(digit);
    const [from, setFrom] = useState<string | null>(null);
    if (digit !== shown) {
        setShown(digit);
        setFrom(reducedMotion() ? null : shown);
    }
    return (
        <span className="flap">
            <span className="flap-half top">
                <b>{shown}</b>
            </span>
            <span className="flap-half bottom">
                <b>{from ?? shown}</b>
            </span>
            {from !== null && (
                <Fragment key={from + shown}>
                    <span className="flap-half top flap-leaf">
                        <b>{from}</b>
                    </span>
                    <span
                        className="flap-half bottom flap-leaf"
                        onAnimationEnd={(e) => {
                            if (e.animationName === "flap-bottom") setFrom(null);
                        }}
                    >
                        <b>{shown}</b>
                    </span>
                </Fragment>
            )}
        </span>
    );
}

/** Placas de virar com dois algarismos; cada um vira sozinho, e só se mudou. */
function Flaps({ value, label, small }: { value: string; label: string; small?: boolean }) {
    return (
        <div className={cx("flaps", !!small && "small")} role="img" aria-label={label}>
            {[...value].map((digit, i) => (
                <FlapDigit key={i} digit={digit} />
            ))}
        </div>
    );
}

export function Week(props: actions.Week) {
    const [today, setToday] = useState(props.today);
    const [timeZone, setTimeZone] = useState(props.timeZone);
    const [tasks, setTasks] = useState<Task[]>(props.tasks);
    const [clock, setClock] = useState(() => clockIn(props.timeZone, new Date()));
    const [view, setView] = useState<View>("week");
    // dia escolhido no dial (0 = hoje) e dia aberto pelo calendário (passado ou distante)
    const [selIdx, setSelIdx] = useState(0);
    const [dayIdx, setDayIdx] = useState(0);
    const [cal, setCal] = useState({ y: 0, m: 0 });
    const [openId, setOpenId] = useState<number | null>(null);
    // tarefa fechando: o painel fica na tela até terminar de deslizar para baixo da linha
    const [closingId, setClosingId] = useState<number | null>(null);
    const [sheet, setSheet] = useState<Sheet | null>(null);
    // a folha descendo: continua aberta até a transição terminar
    const [sheetLeaving, setSheetLeaving] = useState(false);
    const [editText, setEditText] = useState("");
    const [editNote, setEditNote] = useState("");
    const [editDays, setEditDays] = useState<number[]>([]);
    const [pick, setPick] = useState<Pick>(noPick);
    const [addText, setAddText] = useState("");
    // ajustes recolhendo: ficam na tela até voltar para o botão giratório
    const [settings, setSettings] = useState<"closed" | "open" | "closing">("closed");
    const settingsOpen = settings === "open";
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState<PendingDelete | null>(null);
    // o resultado dos gestos, para os leitores de tela
    const [announce, setAnnounce] = useState("");
    // dia em que a conta foi criada: antes dele não há histórico
    const [since, setSince] = useState(props.since);
    const [email, setEmail] = useState(props.email);
    // histórico do mês visível no calendário (só dias passados, só leitura)
    const [history, setHistory] = useState<{ key: string; tasks: HistoryTask[] } | null>(null);
    const fontStep = useFontStep();
    const themeChoice = useThemeChoice();

    const router = useRouter();
    const tempSeq = useRef(0);
    const focusNext = useRef<string | null>(null);
    const scrollTop = useRef(false);
    const pendingRef = useRef<PendingDelete | null>(null);
    const sheetRef = useRef<HTMLDialogElement>(null);
    const settingsRef = useRef<HTMLElement>(null);
    const cardRef = useRef<HTMLElement>(null);
    // FLIP da tarefa abrindo/fechando: medida de antes e o número da rodada (a mais nova vale)
    const flipFirst = useRef<{ first: Snapshot; panels: Map<string, number> } | null>(null);
    const flipRun = useRef(0);

    const focus = (id: string) => {
        focusNext.current = id;
    };

    // depois de cada render: rola ao topo ao trocar de tela e foca o que foi pedido
    useLayoutEffect(() => {
        if (scrollTop.current) {
            scrollTop.current = false;
            window.scrollTo(0, 0);
        }
        const id = focusNext.current;
        if (id) {
            focusNext.current = null;
            document.getElementById(id)?.focus();
        }
    });

    const shownIdx = view === "week" ? selIdx : dayIdx;
    const dayIso = (idx: number) => addDays(today, idx);

    // ---------- servidor ----------

    const load = useCallback(
        async (keepError = false) => {
            const result = await actions.loadWeek().catch(() => ({ ok: false }) as const);
            if (!result.ok && "signedOut" in result) {
                router.push("/entrar");
                return;
            }
            if (!result.ok) {
                setError(LOAD_ERROR);
                return;
            }
            const week = result.value;
            if (!keepError) setError(null);
            setToday((old) => {
                // o dia virou: volta para a semana, com hoje escolhido
                if (old !== week.today) {
                    setSelIdx(0);
                    setView("week");
                }
                return week.today;
            });
            setTimeZone(week.timeZone);
            setSince(week.since);
            setEmail(week.email);
            setClock(clockIn(week.timeZone, new Date()));
            // uma remoção esperando o "desfazer" não deve reaparecer
            const hidden = pendingRef.current?.task.id;
            setTasks(week.tasks.filter((t) => t.id !== hidden));
        },
        [router],
    );

    const sync = useCallback(
        async <T,>(call: Promise<actions.Result<T>>, onOk?: (value: T) => void) => {
            const result = await call.catch(() => ({ ok: false }) as const);
            if (!result.ok) {
                setError(SAVE_ERROR);
                await load(true);
                return;
            }
            setError(null);
            onOk?.(result.value);
        },
        [load],
    );

    // ---------- relógio e recarga ----------

    const canAutoLoad = useCallback(() => {
        const a = document.activeElement;
        const typing = a instanceof HTMLInputElement && a.value !== "";
        return sheet === null && !typing && !pendingRef.current;
    }, [sheet]);

    useEffect(() => {
        const tick = setInterval(() => {
            const now = new Date();
            if (todayIn(timeZone, now) !== today) {
                void load();
                return;
            }
            setClock(clockIn(timeZone, now));
        }, 60_000);
        // sem botão "atualizar": recarrega ao voltar para o app e a cada 5 minutos
        const refresh = setInterval(() => {
            if (!document.hidden && canAutoLoad()) void load();
        }, 300_000);
        const onVisible = () => {
            if (!document.hidden && canAutoLoad()) void load();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            clearInterval(tick);
            clearInterval(refresh);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [timeZone, today, load, canAutoLoad]);

    // teclado do iPhone: o Safari não encolhe a página, só a área visível. A barra de baixo e a
    // folha sobem junto (--kb = o quanto o teclado cobre; --vvh = a altura que sobra).
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const root = document.documentElement;
        const update = () => {
            const kb = Math.round(window.innerHeight - vv.height - vv.offsetTop);
            root.classList.toggle("kb", kb > 0);
            root.style.setProperty("--kb", `${Math.max(0, kb)}px`);
            root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
        };
        update();
        vv.addEventListener("resize", update);
        vv.addEventListener("scroll", update);
        return () => {
            vv.removeEventListener("resize", update);
            vv.removeEventListener("scroll", update);
        };
    }, []);

    // ---------- histórico do mês visível ----------

    // do começo do mês (ou da conta) até ontem
    const historyRange = (() => {
        const { from, to } = monthRange(cal.y, cal.m);
        const range = {
            from: from < since ? since : from,
            to: to < today ? to : addDays(today, -1),
        };
        return range.from <= range.to ? range : null;
    })();
    const historyKey = historyRange ? `${historyRange.from}/${historyRange.to}` : null;
    const historyReady = history !== null && history.key === historyKey;
    const pastTasks = historyReady ? history.tasks : [];

    useEffect(() => {
        if (view === "week" || !historyKey || history?.key === historyKey) return;
        const [from, to] = historyKey.split("/");
        let stale = false;
        void actions
            .loadHistory({ from, to })
            .catch(() => ({ ok: false }) as const)
            .then((result) => {
                if (stale) return;
                if (!result.ok && "signedOut" in result) router.push("/entrar");
                else if (!result.ok) setError(LOAD_ERROR);
                else setHistory({ key: historyKey, tasks: result.value });
            });
        return () => {
            stale = true;
        };
    }, [view, historyKey, history?.key, router]);

    // ---------- navegação ----------

    const closeSettings = () => setSettings((s) => (s === "open" ? "closing" : s));

    // sem animação: some a tarefa aberta (trocar de dia ou de tela, remover)
    const dropOpen = () => {
        flipRun.current++;
        flipFirst.current = null;
        if (cardRef.current) stopFlip(cardRef.current);
        setOpenId(null);
        setClosingId(null);
    };

    // abrir/fechar a tarefa no lugar: mede antes, o React muda, o efeito abaixo anima a diferença
    const toggleOpen = (id: number) => {
        const card = cardRef.current;
        const opening = openId !== id;
        if (!card || reducedMotion()) {
            setOpenId(opening ? id : null);
            setClosingId(null);
            return;
        }
        flipFirst.current = { first: measure(card), panels: panelOffsets(card) };
        setClosingId(opening ? openId : id);
        setOpenId(opening ? id : null);
    };

    useLayoutEffect(() => {
        const card = cardRef.current;
        const f = flipFirst.current;
        if (!card || !f) return;
        flipFirst.current = null;
        stopFlip(card);
        const closing = closingId !== null ? card.querySelector(`#task-${closingId}`) : null;
        const panels = [openId, closingId].flatMap((id) => {
            const el = id !== null ? card.querySelector(`#panel-${id} > div`) : null;
            const from = f.panels.get(`panel-${id}`);
            return el ? [{ el, from: from ?? null, closing: id === closingId }] : [];
        });
        const anims = playFlip(card, f.first, closing && measureClosed(card, closing), panels);
        const run = ++flipRun.current;
        void Promise.all(anims.map((a) => a.finished)).then(
            () => {
                if (run !== flipRun.current) return;
                // fechou: tira o painel e zera os transforms no mesmo quadro (o layout já bate)
                flushSync(() => setClosingId(null));
                stopFlip(card);
            },
            () => {},
        );
    }, [openId, closingId]);

    const resetForms = () => {
        dropOpen();
        closeSettings();
        setAddText("");
    };

    const pickDay = (idx: number) => {
        if (idx === selIdx) return;
        dropOpen();
        setSelIdx(idx);
    };

    const onDialDay = (e: { currentTarget: HTMLElement }) =>
        pickDay(Number(e.currentTarget.dataset.idx));

    const showView = (next: View) => {
        resetForms();
        setView(next);
        scrollTop.current = true;
    };

    const openCalendar = (y: number, m: number) => {
        setCal({ y, m });
        showView("calendar");
    };

    const openCalendarNow = () => {
        const [y, m] = today.split("-").map(Number) as [number, number];
        openCalendar(y, m - 1);
        focus("cal-title");
    };

    const changeMonth = (delta: number) => {
        const total = cal.y * 12 + cal.m + delta;
        setCal({ y: Math.floor(total / 12), m: total % 12 });
    };

    const pickDate = (iso: string) => {
        const idx = daysBetween(today, iso);
        if (iso < since) return;
        if (idx >= 0 && idx <= 6) {
            setSelIdx(idx);
            showView("week");
        } else {
            setDayIdx(idx);
            showView("day");
        }
        focus("dh");
    };

    const onPickDate = (e: { currentTarget: HTMLElement }) => {
        const iso = e.currentTarget.dataset.iso;
        if (iso) pickDate(iso);
    };

    const backToWeek = () => {
        showView("week");
        focus("cal-open");
    };

    const backToCalendar = () => {
        const iso = dayIso(dayIdx);
        const [y, m] = iso.split("-").map(Number) as [number, number];
        openCalendar(y, m - 1);
        focus(`cd-${iso}`);
    };

    // ---------- ações das tarefas ----------

    const pickedTime = () => (pick.h !== null ? `${pad2(pick.h)}:${pad2(pick.m ?? 0)}` : null);

    const toggleTask = (task: Task, idx: number) => {
        if (task.id < 0) return;
        const iso = dayIso(idx);
        const done = !isDone(task, iso);
        setTasks((list) =>
            list.map((t) =>
                t.id === task.id
                    ? {
                          ...t,
                          doneDates: done
                              ? [...t.doneDates, iso]
                              : t.doneDates.filter((d) => d !== iso),
                      }
                    : t,
            ),
        );
        void sync(actions.setDone({ id: task.id, date: iso, done }));
    };

    const moveTask = (id: number, idx: number, dir: -1 | 1) => {
        const iso = dayIso(idx);
        const swap = swapPositions(tasks, iso, id, dir);
        if (!swap) return;
        const positions = new Map(swap.map((s) => [s.id, s.position]));
        const next = tasks.map((t) =>
            positions.has(t.id) ? { ...t, position: positions.get(t.id)! } : t,
        );
        setTasks(next);
        // mantém o foco no mesmo botão; se ele ficou desativado (topo/fim), vai para o outro
        const list = movableFor(next, iso);
        const i = list.findIndex((t) => t.id === id);
        const sameExists = dir < 0 ? i > 0 : i < list.length - 1;
        const same = dir < 0 ? `up-${id}` : `dn-${id}`;
        focus(sameExists ? same : dir < 0 ? `dn-${id}` : `up-${id}`);
        void sync(actions.moveTask({ id, date: iso, dir }));
    };

    const addTask = (text: string, days: number[] | null, time: string | null) => {
        const iso = dayIso(shownIdx);
        const tempId = -++tempSeq.current;
        setTasks((list) => [
            ...list,
            {
                id: tempId,
                text,
                date: days ? null : iso,
                recurringDays: days,
                time,
                note: null,
                position: Date.now() / 1000,
                doneDates: [],
            },
        ]);
        void sync(actions.addTask({ text, date: iso, days, time }), (newId) =>
            setTasks((list) => list.map((t) => (t.id === tempId ? { ...t, id: newId } : t))),
        );
    };

    // barra de baixo: com texto, adiciona direto; vazia, abre a folha "nova tarefa"
    const submitAdd = (event: FormEvent) => {
        event.preventDefault();
        const text = addText.trim();
        if (text) {
            addTask(text, null, null);
            setAddText("");
            focus("add-text");
            return;
        }
        setEditText("");
        setEditNote("");
        setEditDays([]);
        setPick(noPick);
        setSheet({ mode: "new" });
        setSheetLeaving(false);
    };

    const startEdit = (task: Task) => {
        setEditText(task.text);
        setEditNote(task.note ?? "");
        setPick(pickFrom(task.time));
        setEditDays(task.recurringDays ? [...task.recurringDays] : []);
        setSheet({ mode: "edit", task });
        setSheetLeaving(false);
    };

    // fechar: a folha desce (classe leaving); só depois sai do modo modal e o foco volta
    const closeSheet = () => setSheetLeaving(true);

    useEffect(() => {
        const dialog = sheetRef.current;
        if (!sheetLeaving || !dialog) return;
        let live = true;
        void settled(dialog).then((done) => {
            if (!live || !done) return;
            dialog.close();
            setSheetLeaving(false);
            setSheet((current) => {
                if (current) focus(current.mode === "edit" ? `tx-${current.task.id}` : "add-text");
                return null;
            });
        });
        return () => {
            live = false;
        };
    }, [sheetLeaving]);

    const submitSheet = (event: FormEvent) => {
        event.preventDefault();
        if (!sheet) return;
        const text = editText.trim();
        if (!text) return;
        const time = pickedTime();
        const days = editDays.length ? [...editDays] : null;
        if (sheet.mode === "new") {
            addTask(text, days, time);
            closeSheet();
            return;
        }
        const task = sheet.task;
        const note = editNote.trim() || null;
        const iso = dayIso(shownIdx);
        setTasks((list) =>
            list.map((t) =>
                t.id === task.id
                    ? {
                          ...t,
                          text,
                          time,
                          note,
                          recurringDays: days,
                          date: days ? null : (t.date ?? iso),
                      }
                    : t,
            ),
        );
        closeSheet();
        void sync(actions.updateTask({ id: task.id, text, time, note, days, date: iso }));
    };

    // a folha é um <dialog> modal: prende o foco e deixa o resto inerte
    useEffect(() => {
        const dialog = sheetRef.current;
        if (!dialog) return;
        if (sheet && !dialog.open) {
            dialog.showModal();
            document.getElementById("sheet-text")?.focus();
        }
        if (!sheet && dialog.open) dialog.close();
    }, [sheet]);

    const commitDelete = useCallback(() => {
        const pd = pendingRef.current;
        if (!pd) return;
        clearTimeout(pd.timer);
        pendingRef.current = null;
        setPending(null);
        void sync(actions.removeTask({ id: pd.task.id }));
    }, [sync]);

    // remove na hora e dá 6 segundos para desfazer antes de apagar no servidor
    const deleteTask = (task: Task) => {
        if (task.id < 0) return;
        if (pendingRef.current) commitDelete();
        const index = tasks.findIndex((t) => t.id === task.id);
        if (index < 0) return;
        setTasks((list) => list.filter((t) => t.id !== task.id));
        dropOpen();
        const pd = { task, index, timer: setTimeout(commitDelete, UNDO_MS) };
        pendingRef.current = pd;
        setPending(pd);
        focus("undo-btn");
    };

    const undoDelete = () => {
        const pd = pendingRef.current;
        if (!pd) return;
        clearTimeout(pd.timer);
        pendingRef.current = null;
        setPending(null);
        setTasks((list) => {
            const next = [...list];
            next.splice(Math.min(pd.index, next.length), 0, pd.task);
            return next;
        });
        focus(`tx-${pd.task.id}`);
    };

    // ---------- ajustes ----------

    const changeFont = (delta: number) => {
        applyFontStep(Math.min(FONT_STEPS - 1, Math.max(0, fontStep + delta)), true);
    };

    // fora do painel, um toque fecha os ajustes
    useEffect(() => {
        if (!settingsOpen) return;
        const onDown = (e: PointerEvent) => {
            const target = e.target as Element;
            if (!target.closest("#settings, #knob")) closeSettings();
        };
        document.addEventListener("pointerdown", onDown);
        return () => document.removeEventListener("pointerdown", onDown);
    }, [settingsOpen]);

    // recolhendo: quando a transição termina, os ajustes saem da tela (tocar de novo reabre do
    // ponto em que estavam)
    useEffect(() => {
        const el = settingsRef.current;
        if (settings !== "closing" || !el) return;
        let live = true;
        void settled(el).then((done) => {
            if (live && done) setSettings("closed");
        });
        return () => {
            live = false;
        };
    }, [settings]);

    // Esc fecha ajustes, a tarefa aberta ou volta uma tela (a folha fecha pelo próprio <dialog>)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape" && e.key !== "Esc") return;
            if (sheet) return;
            if (settingsOpen) {
                closeSettings();
                focus("knob");
            } else if (openId !== null) {
                const id = openId;
                toggleOpen(id);
                focus(`tx-${id}`);
            } else if (view === "day") backToCalendar();
            else if (view === "calendar") backToWeek();
            else return;
            e.preventDefault();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    });

    // ---------- partes da tela ----------

    const knob = (
        <>
            <button
                type="button"
                className="knob"
                id="knob"
                aria-label={settingsOpen ? "Fechar ajustes" : "Ajustes"}
                aria-expanded={settingsOpen}
                aria-controls="settings"
                onClick={() => setSettings(settingsOpen ? "closing" : "open")}
            />
            {settings !== "closed" && (
                <section
                    ref={settingsRef}
                    className={cx("settings", settings === "closing" && "closing")}
                    id="settings"
                    role="dialog"
                    aria-label="Ajustes"
                    inert={settings === "closing"}
                >
                    <h2 className="ruler">Ajustes</h2>
                    <p className="settings-label" id="font-label">
                        Tamanho do texto
                    </p>
                    <div className="font-row" role="group" aria-labelledby="font-label">
                        <button
                            type="button"
                            className="font-key"
                            id="font-down"
                            aria-label="Diminuir texto"
                            disabled={fontStep === 0}
                            onClick={() => changeFont(-1)}
                        >
                            A
                        </button>
                        <div
                            className="font-dots"
                            role="img"
                            aria-label={`Tamanho ${fontStep + 1} de ${FONT_STEPS}`}
                        >
                            {Array.from({ length: FONT_STEPS }, (_, i) => (
                                <span
                                    key={i}
                                    className={cx(i === fontStep && "on", i < fontStep && "before")}
                                />
                            ))}
                        </div>
                        <button
                            type="button"
                            className="font-key big"
                            id="font-up"
                            aria-label="Aumentar texto"
                            disabled={fontStep === FONT_STEPS - 1}
                            onClick={() => changeFont(1)}
                        >
                            A
                        </button>
                    </div>
                    <p className="settings-label theme" id="theme-label">
                        Tema
                    </p>
                    <div className="segmented" role="radiogroup" aria-labelledby="theme-label">
                        <span
                            className="seg-thumb"
                            aria-hidden="true"
                            style={
                                {
                                    "--i": THEMES.findIndex((t) => t.value === themeChoice),
                                } as CSSProperties
                            }
                        />
                        {THEMES.map(({ value, label }) => (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                id={`theme-${value}`}
                                aria-checked={themeChoice === value}
                                onClick={() => applyTheme(value, true)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <p className="settings-hint">Auto segue o tema do iPhone.</p>
                    <div className="settings-account">
                        <span>{email}</span>
                        <form action={signOut}>
                            <button type="submit" className="text-link">
                                Sair
                            </button>
                        </form>
                    </div>
                </section>
            )}
        </>
    );

    // o mesmo topo em todas as telas: wordmark à esquerda, botão giratório à direita
    const header = (
        <header className="topbar">
            <Wordmark />
            {knob}
        </header>
    );

    const status = (
        <div id="status" className="status" role="status" aria-live="polite">
            {error && (
                <span className="notice">
                    <span className="led" aria-hidden="true" />
                    {error}
                </span>
            )}
        </div>
    );

    // tarefa: direita conclui (ou reabre), esquerda remove com o desfazer; antes do limite, volta
    const endTaskSwipe = (
        e: ReactPointerEvent<HTMLElement>,
        task: Task,
        idx: number,
        done: boolean,
    ) =>
        swipeEnd(e, (dx, el) => {
            el.classList.remove("swiping");
            el.removeAttribute("data-dir");
            el.removeAttribute("data-armed");
            const result = dx === null ? null : taskSwipe(dx);
            if (result === "done") {
                toggleTask(task, idx);
                setAnnounce(`${task.text}: ${done ? "reaberta" : "feita"}.`);
            } else if (result === "remove") deleteTask(task);
        });

    const renderTask = (task: Task, idx: number, n: number) => {
        const iso = dayIso(idx);
        const done = isDone(task, iso);
        const late = isLate(task, iso, today, clock);
        const open = openId === task.id;
        const closing = closingId === task.id;
        const label =
            task.text +
            (task.time ? `, às ${task.time}` : "") +
            (late ? ", atrasada" : "") +
            (task.recurringDays ? `, repete ${daysText(task.recurringDays)}` : "") +
            (task.note ? ", tem nota" : "");
        const movable = movableFor(tasks, iso);
        const pos = movable.findIndex((t) => t.id === task.id);
        // deslizar: direita conclui (ou reabre), esquerda remove (com o desfazer). Equivale à caixa
        // e ao Remover da tarefa aberta.
        const canSwipe = !open && !closing && task.id > 0;
        const swipe = canSwipe && {
            onPointerDown: swipeDown,
            onClickCapture: swipeClick,
            onPointerMove: (e: ReactPointerEvent<HTMLElement>) =>
                swipeMove(e, (dx, el) => {
                    el.classList.add("swiping");
                    el.style.setProperty("--dx", `${resist(dx)}px`);
                    el.dataset.dir = dx > 0 ? "done" : "remove";
                    el.toggleAttribute("data-armed", taskSwipe(dx) !== null);
                }),
            onPointerUp: (e: ReactPointerEvent<HTMLElement>) => endTaskSwipe(e, task, idx, done),
            onPointerCancel: (e: ReactPointerEvent<HTMLElement>) =>
                endTaskSwipe(e, task, idx, done),
        };
        return (
            <div
                key={task.id}
                className={cx(
                    "task",
                    done && "done",
                    (open || closing) && "open",
                    task.id < 0 && "temp",
                )}
                id={`task-${task.id}`}
                {...swipe}
            >
                {canSwipe && (
                    <span className="swipe-under" aria-hidden="true">
                        <span className="swipe-done">{done ? "Reabrir" : "Feita"}</span>
                        <span className="swipe-remove">Remover</span>
                    </span>
                )}
                <div className="task-row">
                    <span className="task-n" aria-hidden="true">
                        {pad2(n)}
                    </span>
                    <button
                        type="button"
                        className="box-btn"
                        id={`tg-${task.id}`}
                        role="checkbox"
                        aria-checked={done}
                        aria-label={label}
                        onClick={() => toggleTask(task, idx)}
                    >
                        <span className="box">
                            <Cross />
                        </span>
                    </button>
                    <button
                        type="button"
                        className="task-text"
                        id={`tx-${task.id}`}
                        aria-expanded={open}
                        aria-controls={`panel-${task.id}`}
                        onClick={() => {
                            if (task.id > 0) toggleOpen(task.id);
                        }}
                    >
                        {task.text}
                        {task.note && !open && (
                            <span className="note-ic" title="Tem nota">
                                <NoteIcon />
                            </span>
                        )}
                    </button>
                    {task.time && !done && (
                        <span className={cx("time-tag", late && "late")} aria-hidden="true">
                            {task.time}
                        </span>
                    )}
                    {task.recurringDays && (
                        <span className="rec-tag" aria-hidden="true">
                            {recurrenceTag(task.recurringDays)}
                        </span>
                    )}
                </div>
                {(open || closing) && (
                    <div className="task-panel" id={`panel-${task.id}`} inert={closing}>
                        <div>
                            {task.note && <p className="task-note">{task.note}</p>}
                            <div className="task-actions">
                                <button
                                    type="button"
                                    className="key-sm"
                                    id={`ed-${task.id}`}
                                    aria-label={`Editar ${task.text}`}
                                    onClick={() => startEdit(task)}
                                >
                                    Editar
                                </button>
                                <button
                                    type="button"
                                    className="key-sm sq"
                                    id={`up-${task.id}`}
                                    aria-label={`Subir ${task.text}`}
                                    disabled={pos <= 0}
                                    onClick={() => moveTask(task.id, idx, -1)}
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    className="key-sm sq"
                                    id={`dn-${task.id}`}
                                    aria-label={`Descer ${task.text}`}
                                    disabled={pos < 0 || pos >= movable.length - 1}
                                    onClick={() => moveTask(task.id, idx, 1)}
                                >
                                    ↓
                                </button>
                                <button
                                    type="button"
                                    className="remove"
                                    id={`rm-${task.id}`}
                                    aria-label={`Remover ${task.text}`}
                                    onClick={() => deleteTask(task)}
                                >
                                    Remover
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // dia passado: só consulta. Sem botões nem gestos; feita/não feita em texto.
    const renderPastTask = (task: HistoryTask, iso: string, n: number) => {
        const done = isDone(task, iso);
        return (
            <div key={task.id} className={cx("task past", done && "done")} id={`task-${task.id}`}>
                <div className="task-row">
                    <span className="task-n" aria-hidden="true">
                        {pad2(n)}
                    </span>
                    <span className="box" aria-hidden="true">
                        <Cross />
                    </span>
                    <p className="task-text">
                        {task.text}
                        <span className="sr">, {done ? "feita" : "não feita"}</span>
                        {task.time && <span className="sr">, às {task.time}</span>}
                        {task.recurringDays && (
                            <span className="sr">, repete {daysText(task.recurringDays)}</span>
                        )}
                    </p>
                    {task.time && !done && (
                        <span className="time-tag" aria-hidden="true">
                            {task.time}
                        </span>
                    )}
                    {task.recurringDays && (
                        <span className="rec-tag" aria-hidden="true">
                            {recurrenceTag(task.recurringDays)}
                        </span>
                    )}
                </div>
                {task.note && <p className="task-note">{task.note}</p>}
            </div>
        );
    };

    const renderCard = (idx: number) => {
        const iso = dayIso(idx);
        const past = idx < 0;
        const list: Task[] = past ? historyFor(pastTasks, iso) : tasksFor(tasks, iso);
        const done = list.filter((t) => isDone(t, iso)).length;
        return (
            <section className="card day" aria-labelledby="dh" ref={cardRef}>
                <span className="card-top" aria-hidden="true" />
                <span className="card-body" aria-hidden="true" />
                <span className="card-foot" aria-hidden="true" />
                <div className="card-head">
                    <Flaps value={pad2(Number(iso.slice(8)))} label={fullDate(iso)} />
                    <div className="card-title">
                        <h2 id="dh" tabIndex={-1} className="swap" key={`h-${iso}`}>
                            {DAY_NAMES[weekday(iso)]}
                        </h2>
                        <p id="date-line" className="swap" key={`p-${iso}`}>
                            {dialLine(iso, idx, clock)}
                        </p>
                    </div>
                </div>
                <div className="ruler">
                    Tarefas
                    <span className="count">
                        <span aria-hidden="true">
                            {done}/{list.length}
                        </span>
                        <span className="sr">
                            , {done} de {list.length} feitas
                        </span>
                    </span>
                </div>
                {past && <p className="past-tag">Dia passado: só consulta</p>}
                {list.length === 0 && (!past || historyReady) && (
                    <p className="empty">Nada por aqui.</p>
                )}
                <div>
                    {list.map((t, i) =>
                        past
                            ? renderPastTask(t as HistoryTask, iso, i + 1)
                            : renderTask(t, idx, i + 1),
                    )}
                </div>
            </section>
        );
    };

    const addDock = (
        <form className="dock" onSubmit={submitAdd}>
            <label className="sr" htmlFor="add-text">
                Nova tarefa para {DAY_FULL[weekday(dayIso(shownIdx))]}
            </label>
            <input
                type="text"
                className="dock-field"
                id="add-text"
                placeholder="Adicionar tarefa..."
                autoComplete="off"
                maxLength={TEXT_MAX}
                value={addText}
                onChange={(e) => setAddText(e.target.value)}
            />
            {view === "week" && (
                <button
                    type="button"
                    className="dock-key"
                    id="cal-open"
                    aria-label="Abrir calendário"
                    onClick={openCalendarNow}
                >
                    <CalendarIcon />
                </button>
            )}
            <button
                type="submit"
                className="dock-key accent"
                id="add-btn"
                aria-label={addText.trim() ? "Adicionar" : "Nova tarefa com horário ou repetição"}
            >
                <PlusIcon />
            </button>
        </form>
    );

    // dial: o ponteiro segue o dedo; ao soltar, vai para o dia mais perto
    const endDialSwipe = (e: ReactPointerEvent<HTMLElement>) =>
        swipeEnd(e, (dx, el) => {
            el.classList.remove("dragging");
            el.style.removeProperty("--drag");
            if (dx === null) return;
            const next = Math.min(6, Math.max(0, selIdx + dialSteps(dx, el.clientWidth / 7)));
            if (next === selIdx) return;
            pickDay(next);
            const iso = dayIso(next);
            setAnnounce(`${DAY_FULL[weekday(iso)]} ${iso.slice(8)}`);
        });

    const renderWeek = () => (
        <>
            {header}
            {status}
            <nav
                className="dial"
                aria-label="Escolher o dia"
                onPointerDown={swipeDown}
                onClickCapture={swipeClick}
                onPointerMove={(e) =>
                    swipeMove(e, (dx, el) => {
                        el.classList.add("dragging");
                        el.style.setProperty("--drag", `${dx}px`);
                    })
                }
                onPointerUp={endDialSwipe}
                onPointerCancel={endDialSwipe}
            >
                <div className="dial-days">
                    {Array.from({ length: 7 }, (_, i) => {
                        const iso = dayIso(i);
                        const dow = weekday(iso);
                        const has = tasksFor(tasks, iso).length > 0;
                        const d = iso.slice(8);
                        return (
                            <button
                                type="button"
                                key={i}
                                className={cx("dial-day", has && "has")}
                                id={`dd-${i}`}
                                aria-pressed={i === selIdx}
                                aria-label={`${DAY_FULL[dow]} ${d}${has ? ", com tarefas" : ""}`}
                                data-idx={i}
                                onClick={onDialDay}
                            >
                                <span className="dial-dow">{DAY_ABBR[dow]}</span>
                                <span className="dial-num">{d}</span>
                                <span className="dial-dot" />
                            </button>
                        );
                    })}
                </div>
                <DialScale sel={selIdx} />
            </nav>
            <main>{renderCard(selIdx)}</main>
            {addDock}
        </>
    );

    const renderCalendar = () => {
        const [sy, sm] = since.split("-").map(Number) as [number, number];
        // "‹" vai até o mês em que a conta foi criada
        const atFirst = cal.y * 12 + cal.m <= sy * 12 + sm - 1;
        const count = pendingDaysIn(tasks, cal.y, cal.m, today);
        const month = MONTHS[cal.m]!;
        return (
            <>
                {header}
                <nav className="backbar">
                    <button type="button" className="key-light" id="back-btn" onClick={backToWeek}>
                        <ChevronLeft />
                        Semana
                    </button>
                </nav>
                {status}
                <main>
                    <section className="card cal-card" aria-labelledby="cal-title">
                        <div className="card-head">
                            <Flaps value={pad2(cal.m + 1)} label={`Mês ${cal.m + 1}`} small />
                            <div className="card-title">
                                <h2 id="cal-title" tabIndex={-1} aria-live="polite">
                                    {month[0]!.toUpperCase() + month.slice(1)}
                                </h2>
                                <p>
                                    {cal.y} · {count === 1 ? "1 pendente" : `${count} pendentes`}
                                </p>
                            </div>
                        </div>
                        <div className="ruler" aria-hidden="true">
                            Dias
                        </div>
                        <div className="cal-week">
                            {DAY_SHORT.map((s, w) => (
                                <abbr key={w} title={DAY_FULL[w]}>
                                    {s}
                                </abbr>
                            ))}
                        </div>
                        <div className="cal-grid">
                            {monthGrid(cal.y, cal.m)
                                .flat()
                                .map((iso, i) => {
                                    if (!iso) return <span className="cal-pad" key={i} />;
                                    const past = iso < today;
                                    const blocked = iso < since;
                                    const isToday = iso === today;
                                    const dot = !past && hasPendingOn(tasks, iso);
                                    const trace = past && !blocked && hasHistoryOn(pastTasks, iso);
                                    const day = Number(iso.slice(8));
                                    const label =
                                        `${day} de ${month}, ${DAY_FULL[weekday(iso)]}` +
                                        (isToday ? ", hoje" : "") +
                                        (dot ? ", com tarefas" : "") +
                                        (trace ? ", com histórico" : "");
                                    return (
                                        <button
                                            type="button"
                                            key={i}
                                            className={cx(
                                                "cal-day",
                                                past && "past",
                                                isToday && "today",
                                            )}
                                            id={`cd-${iso}`}
                                            aria-label={label}
                                            aria-current={isToday ? "date" : undefined}
                                            disabled={blocked}
                                            data-iso={iso}
                                            onClick={onPickDate}
                                        >
                                            {pad2(day)}
                                            {(dot || trace) && (
                                                <span className="dot" aria-hidden="true" />
                                            )}
                                        </button>
                                    );
                                })}
                        </div>
                        <div className="cal-legend" aria-hidden="true">
                            <span>
                                <i />
                                pendente
                            </span>
                            <span>
                                <i className="hist" />
                                histórico
                            </span>
                        </div>
                    </section>
                </main>
                <div className="dock">
                    <button
                        type="button"
                        className="dock-key wide"
                        id="cal-prev"
                        aria-label="Mês anterior"
                        disabled={atFirst}
                        onClick={() => changeMonth(-1)}
                    >
                        <ChevronLeft />
                    </button>
                    <p className="dock-month" aria-hidden="true">
                        {month[0]!.toUpperCase() + month.slice(1, 3)} {cal.y}
                    </p>
                    <button
                        type="button"
                        className="dock-key accent wide"
                        id="cal-next"
                        aria-label="Próximo mês"
                        onClick={() => changeMonth(1)}
                    >
                        <ChevronRight />
                    </button>
                </div>
            </>
        );
    };

    // dia aberto pelo calendário: passado (só consulta, sem barra) ou distante (com barra)
    const renderDayView = () => (
        <>
            {header}
            <nav className="backbar">
                <button type="button" className="key-light" id="back-btn" onClick={backToCalendar}>
                    <ChevronLeft />
                    Calendário
                </button>
            </nav>
            {status}
            <main>{renderCard(dayIdx)}</main>
            {dayIdx >= 0 && addDock}
        </>
    );

    // grade de hora (06–23; "madrugada" mostra 00–05) e minutos (:00/:15/:30/:45 ou de 5 em 5)
    const renderSheet = () => {
        if (!sheet) return null;
        const hours = Array.from(
            { length: pick.night ? 24 : 18 },
            (_, i) => i + (pick.night ? 0 : 6),
        );
        let mins = pick.fine ? Array.from({ length: 12 }, (_, i) => i * 5) : [0, 15, 30, 45];
        // um horário salvo fora da grade (ex.: 12:10) continua escolhível
        if (pick.m !== null && !mins.includes(pick.m))
            mins = [...mins, pick.m].sort((a, b) => a - b);
        const time = pickedTime();
        const links = [
            !pick.night && (
                <button
                    type="button"
                    key="night"
                    id="tp-night"
                    onClick={() => {
                        setPick((p) => ({ ...p, night: true }));
                        focus("tph-0");
                    }}
                >
                    madrugada (00 a 05)
                </button>
            ),
            !pick.fine && (
                <button
                    type="button"
                    key="fine"
                    id="tp-fine"
                    onClick={() => {
                        setPick((p) => ({ ...p, fine: true }));
                        focus("tpm-5");
                    }}
                >
                    minutos de 5 em 5
                </button>
            ),
            time && (
                <button
                    type="button"
                    key="clear"
                    id="tp-clear"
                    onClick={() => setPick((p) => ({ ...p, h: null, m: null }))}
                >
                    sem horário
                </button>
            ),
        ].filter(Boolean);
        return (
            <form className="sheet-form" onSubmit={submitSheet} inert={sheetLeaving}>
                <span className="grip" aria-hidden="true" />
                <h2 className="ruler" id="sheet-title">
                    {sheet.mode === "new" ? "Nova tarefa" : "Editar tarefa"}
                </h2>
                <label className="sr" htmlFor="sheet-text">
                    Texto da tarefa
                </label>
                <input
                    type="text"
                    className="field"
                    id="sheet-text"
                    value={editText}
                    maxLength={TEXT_MAX}
                    autoComplete="off"
                    onChange={(e) => setEditText(e.target.value)}
                />
                {sheet.mode === "edit" && (
                    <>
                        <label className="sr" htmlFor="sheet-note">
                            Nota (opcional)
                        </label>
                        <textarea
                            className="field note"
                            id="sheet-note"
                            rows={2}
                            maxLength={NOTE_MAX}
                            placeholder="Nota (opcional)"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                        />
                    </>
                )}
                <div className="ruler" id="tp-h-label">
                    Hora
                    {time && (
                        <span className="time-chip" aria-live="polite">
                            <span className="sr">Horário: </span>
                            {time}
                        </span>
                    )}
                </div>
                <div className="grid-keys" role="group" aria-labelledby="tp-h-label">
                    {hours.map((h) => (
                        <button
                            type="button"
                            key={h}
                            id={`tph-${h}`}
                            aria-pressed={pick.h === h}
                            aria-label={`${h} horas`}
                            onClick={() => setPick((p) => ({ ...p, h, m: p.m ?? 0 }))}
                        >
                            {pad2(h)}
                        </button>
                    ))}
                </div>
                {links.length > 0 && (
                    <p className="sheet-links">
                        {links.map((link, i) => (
                            <span key={i}>
                                {i > 0 && " · "}
                                {link}
                            </span>
                        ))}
                    </p>
                )}
                <div
                    className={cx("grid-keys", mins.length === 4 && "four")}
                    role="group"
                    aria-label="Minutos"
                >
                    {mins.map((m) => (
                        <button
                            type="button"
                            key={m}
                            id={`tpm-${m}`}
                            aria-pressed={pick.h !== null && pick.m === m}
                            aria-label={`${m} minutos`}
                            onClick={() => setPick((p) => ({ ...p, h: p.h ?? 9, m }))}
                        >
                            :{pad2(m)}
                        </button>
                    ))}
                </div>
                <div className="ruler" id="rep-label">
                    Repetir
                    <span className="sr">(nenhum dia = só neste dia)</span>
                </div>
                <div className="grid-keys seven" role="group" aria-labelledby="rep-label">
                    {DAY_SHORT.map((short, d) => (
                        <button
                            type="button"
                            key={d}
                            id={`rep-${d}`}
                            aria-pressed={editDays.includes(d)}
                            aria-label={DAY_FULL[d]}
                            onClick={() => setEditDays((days) => toggleIn(days, d))}
                        >
                            {short}
                        </button>
                    ))}
                </div>
                <div className="sheet-actions">
                    <button type="button" onClick={closeSheet}>
                        Cancelar
                    </button>
                    <button type="submit" className="save">
                        Salvar
                    </button>
                </div>
            </form>
        );
    };

    return (
        <>
            <div className="app">
                {view === "calendar"
                    ? renderCalendar()
                    : view === "day"
                      ? renderDayView()
                      : renderWeek()}
            </div>
            <p className="sr" role="status" aria-live="polite">
                {announce}
            </p>
            <div className="toast-host" role="status" aria-live="polite">
                {pending && (
                    <div className="toast">
                        <span className="toast-text">“{pending.task.text}” removida.</span>
                        <button
                            type="button"
                            className="toast-btn"
                            id="undo-btn"
                            onClick={undoDelete}
                        >
                            desfazer
                        </button>
                    </div>
                )}
            </div>
            <dialog
                ref={sheetRef}
                className={cx("sheet", sheetLeaving && "leaving")}
                aria-labelledby="sheet-title"
                onCancel={(e) => {
                    e.preventDefault();
                    closeSheet();
                }}
                onClick={(e) => {
                    // toque no fundo escurecido fecha a folha
                    if (e.target === e.currentTarget) closeSheet();
                }}
            >
                {renderSheet()}
            </dialog>
        </>
    );
}
