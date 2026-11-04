"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import {
    addDays,
    clockIn,
    dateLine,
    DAY_FULL,
    DAY_NAMES,
    DAY_SHORT,
    daysBetween,
    daysText,
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
    pendingCount,
    shortDate,
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
import { applyFontStep, applyTheme, FONT_STEPS, useDark, useFontStep } from "./appearance";

const cx = (...names: (string | false | null)[]) => names.filter(Boolean).join(" ");

// A semana: porta de legacy/index.html (lista de 7 dias, dia em foco, calendário, dia distante).
// Atualização otimista: a tela muda na hora; se o servidor recusar, avisa e recarrega.

const UNDO_MS = 6000;
const SAVE_ERROR = "Não foi possível salvar a última alteração. A lista foi recarregada.";
const LOAD_ERROR = "Sem conexão com o servidor. Tente de novo em instantes.";

type View = "list" | "calendar" | "day";
type Pick = { h: number | null; m: number | null; night: boolean; fine: boolean };
type PendingDelete = { task: Task; index: number; timer: ReturnType<typeof setTimeout> };

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

function ThemeIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
        </svg>
    );
}

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

export function Week(props: actions.Week) {
    const [today, setToday] = useState(props.today);
    const [timeZone, setTimeZone] = useState(props.timeZone);
    const [tasks, setTasks] = useState<Task[]>(props.tasks);
    const [clock, setClock] = useState(() => clockIn(props.timeZone, new Date()));
    const [view, setView] = useState<View>("list");
    const [openIdx, setOpenIdx] = useState(0);
    const [listOpenIdx, setListOpenIdx] = useState(0);
    const [cal, setCal] = useState({ y: 0, m: 0 });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editText, setEditText] = useState("");
    const [editNote, setEditNote] = useState("");
    const [editDays, setEditDays] = useState<number[]>([]);
    const [addText, setAddText] = useState("");
    const [addRepeat, setAddRepeat] = useState(false);
    const [repeatDays, setRepeatDays] = useState<number[]>([]);
    const [timeOpen, setTimeOpen] = useState(false);
    const [pick, setPick] = useState<Pick>(noPick);
    const [actionsId, setActionsId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState<PendingDelete | null>(null);
    // dia em que a conta foi criada: antes dele não há histórico
    const [since, setSince] = useState(props.since);
    // histórico do mês visível no calendário (só dias passados, só leitura)
    const [history, setHistory] = useState<{ key: string; tasks: HistoryTask[] } | null>(null);
    const fontStep = useFontStep();
    const dark = useDark();

    const router = useRouter();
    const tempSeq = useRef(0);
    const focusNext = useRef<string | null>(null);
    const scrollAnchor = useRef<{ id: string; top: number } | null>(null);
    const scrollTop = useRef(false);
    const pendingRef = useRef<PendingDelete | null>(null);

    const focus = (id: string) => {
        focusNext.current = id;
    };

    // depois de cada render: mantém o nome do dia parado sob o dedo, rola ao topo e foca
    useLayoutEffect(() => {
        if (scrollTop.current) {
            scrollTop.current = false;
            window.scrollTo(0, 0);
        }
        const anchor = scrollAnchor.current;
        if (anchor) {
            scrollAnchor.current = null;
            const el = document.getElementById(anchor.id);
            if (el) window.scrollBy(0, el.getBoundingClientRect().top - anchor.top);
        }
        const id = focusNext.current;
        if (id) {
            focusNext.current = null;
            document.getElementById(id)?.focus();
        }
    });

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
                // o dia virou: volta para a lista, com hoje aberto
                if (old !== week.today) {
                    setOpenIdx(0);
                    setListOpenIdx(0);
                    setView("list");
                }
                return week.today;
            });
            setTimeZone(week.timeZone);
            setSince(week.since);
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
        return editingId === null && !typing && !pendingRef.current;
    }, [editingId]);

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

    // ---------- aparência ----------

    const changeFont = (delta: number) => {
        applyFontStep(Math.min(FONT_STEPS - 1, Math.max(0, fontStep + delta)), true);
    };

    const toggleTheme = () => {
        applyTheme(dark ? "light" : "dark", true);
    };

    // ---------- navegação ----------

    const resetForms = () => {
        setEditingId(null);
        setActionsId(null);
        setAddRepeat(false);
        setTimeOpen(false);
        setRepeatDays([]);
        setAddText("");
    };

    const openDay = (idx: number, button: HTMLElement) => {
        scrollAnchor.current = { id: `dh-${idx}`, top: button.getBoundingClientRect().top };
        resetForms();
        setOpenIdx(idx);
        focus(`dh-${idx}`);
    };

    const showView = (next: View) => {
        resetForms();
        setView(next);
        scrollTop.current = true;
    };

    const openCalendar = (y: number, m: number) => {
        if (view === "list") setListOpenIdx(openIdx);
        setCal({ y, m });
        showView("calendar");
    };

    const changeMonth = (delta: number) => {
        const total = cal.y * 12 + cal.m + delta;
        const next = { y: Math.floor(total / 12), m: total % 12 };
        setCal(next);
        const [ty, tm] = today.split("-").map(Number) as [number, number];
        if (next.y === ty && next.m === tm - 1) focus("cal-title");
    };

    const pickDate = (iso: string) => {
        const idx = daysBetween(today, iso);
        if (iso < since) return;
        if (idx >= 0 && idx <= 6) {
            setOpenIdx(idx);
            setListOpenIdx(idx);
            showView("list");
            if (idx > 0) {
                scrollTop.current = false;
                focusNext.current = `dh-${idx}`;
                requestAnimationFrame(() =>
                    document.getElementById(`day-${idx}`)?.scrollIntoView(true),
                );
            } else {
                focus(`dh-${idx}`);
            }
            return;
        }
        setOpenIdx(idx);
        showView("day");
        focus(`dh-${idx}`);
    };

    const backToList = () => {
        setOpenIdx(listOpenIdx);
        showView("list");
        focus("cal-open");
    };

    const backToCalendar = () => {
        const iso = dayIso(openIdx);
        const [y, m] = iso.split("-").map(Number) as [number, number];
        openCalendar(y, m - 1);
        focus(`cd-${iso}`);
    };

    // o intervalo de histórico do mês visível: do começo do mês (ou da conta) até ontem
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
        if (view === "list" || !historyKey || history?.key === historyKey) return;
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

    // ---------- ações das tarefas ----------

    const pickedTime = () =>
        timeOpen && pick.h !== null ? `${pad2(pick.h)}:${pad2(pick.m ?? 0)}` : null;

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
        // mantém o foco no mesmo botão; se ele sumiu (chegou ao topo/fim), vai para o outro
        const list = movableFor(next, iso);
        const i = list.findIndex((t) => t.id === id);
        const sameExists = dir < 0 ? i > 0 : i < list.length - 1;
        const same = dir < 0 ? `up-${id}` : `dn-${id}`;
        focus(sameExists ? same : dir < 0 ? `dn-${id}` : `up-${id}`);
        void sync(actions.moveTask({ id, date: iso, dir }));
    };

    const submitAdd = (event: FormEvent) => {
        event.preventDefault();
        const text = addText.trim();
        if (!text) return;
        const iso = dayIso(openIdx);
        const days = addRepeat && repeatDays.length ? [...repeatDays] : null;
        const time = pickedTime();
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
        setAddText("");
        setAddRepeat(false);
        setTimeOpen(false);
        setRepeatDays([]);
        // continua no campo para adicionar a próxima
        focus("add-text");
        void sync(actions.addTask({ text, date: iso, days, time }), (newId) =>
            setTasks((list) => list.map((t) => (t.id === tempId ? { ...t, id: newId } : t))),
        );
    };

    const startEdit = (task: Task) => {
        setEditingId(task.id);
        setActionsId(null);
        setEditText(task.text);
        setEditNote(task.note ?? "");
        setTimeOpen(!!task.time);
        setPick(pickFrom(task.time));
        setEditDays(task.recurringDays ? [...task.recurringDays] : []);
        focus("edit-text");
    };

    const cancelEdit = () => {
        const id = editingId;
        setEditingId(null);
        setTimeOpen(false);
        focus(`mo-${id}`);
    };

    const submitEdit = (event: FormEvent, task: Task) => {
        event.preventDefault();
        const text = editText.trim();
        if (!text) return;
        const note = editNote.trim() || null;
        const time = pickedTime();
        const iso = dayIso(openIdx);
        const days = editDays.length ? [...editDays] : null;
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
        setTimeOpen(false);
        setEditingId(null);
        focus(`tg-${task.id}`);
        void sync(actions.updateTask({ id: task.id, text, time, note, days, date: iso }));
    };

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
        setActionsId(null);
        const pd = { task, index, timer: setTimeout(commitDelete, UNDO_MS) };
        pendingRef.current = pd;
        setPending(pd);
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
        focus(`tg-${pd.task.id}`);
    };

    // Esc fecha a edição, o menu de ações ou volta uma tela
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape" && e.key !== "Esc") return;
            if (editingId !== null) cancelEdit();
            else if (actionsId !== null) {
                const id = actionsId;
                setActionsId(null);
                focus(`mo-${id}`);
            } else if (view === "day") backToCalendar();
            else if (view === "calendar") backToList();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    });

    // ---------- partes da tela ----------

    const weekdayButtons = (
        selected: number[],
        onToggle: (day: number) => void,
        prefix: string,
        labelId: string,
    ) => (
        <div className="weekdays" role="group" aria-labelledby={labelId}>
            {DAY_SHORT.map((short, d) => {
                const on = selected.includes(d);
                return (
                    <button
                        key={d}
                        type="button"
                        className={cx("wd", on && "on")}
                        id={`${prefix}-${d}`}
                        aria-pressed={on}
                        aria-label={DAY_FULL[d]}
                        onClick={() => onToggle(d)}
                    >
                        {short}
                    </button>
                );
            })}
        </div>
    );

    const timeToggle = (
        <button
            type="button"
            className={cx("btn alt", timeOpen && "on")}
            id="time-btn"
            aria-pressed={timeOpen}
            onClick={() => {
                setTimeOpen(!timeOpen);
                setPick(noPick);
            }}
        >
            Horário
        </button>
    );

    const pickerTable = (
        values: number[],
        selected: number | null,
        onPick: (v: number) => void,
        prefix: string,
        perRow: number,
        unit: string,
    ) => {
        const rows: number[][] = [];
        for (let i = 0; i < values.length; i += perRow) rows.push(values.slice(i, i + perRow));
        return (
            <table className="tp-grid">
                <tbody>
                    {rows.map((row, r) => (
                        <tr key={r}>
                            {row.map((v) => (
                                <td key={v}>
                                    <button
                                        type="button"
                                        className={cx("tp-btn", selected === v && "on")}
                                        id={`${prefix}${v}`}
                                        aria-pressed={selected === v}
                                        aria-label={`${v} ${unit}`}
                                        onClick={() => onPick(v)}
                                    >
                                        {pad2(v)}
                                    </button>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    // grade de toques: hora (06–23, com 00–05 em "madrugada") e minutos (00/15/30/45)
    const timePicker = () => {
        const hours = Array.from(
            { length: pick.night ? 24 : 18 },
            (_, i) => i + (pick.night ? 0 : 6),
        );
        let mins = pick.fine ? Array.from({ length: 12 }, (_, i) => i * 5) : [0, 15, 30, 45];
        // um horário salvo fora da grade (ex.: 12:10) continua escolhível
        if (pick.m !== null && !mins.includes(pick.m))
            mins = [...mins, pick.m].sort((a, b) => a - b);
        const time = pickedTime();
        return (
            <>
                <div className="tp" role="group" aria-labelledby="tp-h-label">
                    <div className="hint" id="tp-h-label">
                        Hora
                    </div>
                    {pickerTable(
                        hours,
                        pick.h,
                        (h) => setPick((p) => ({ ...p, h, m: p.m ?? 0 })),
                        "tph-",
                        6,
                        "horas",
                    )}
                    {!pick.night && (
                        <button
                            type="button"
                            className="link tp-night"
                            id="tp-night"
                            onClick={() => {
                                setPick((p) => ({ ...p, night: true }));
                                focus("tph-0");
                            }}
                        >
                            madrugada (00 a 05)
                        </button>
                    )}
                </div>
                <div className="tp" role="group" aria-labelledby="tp-m-label">
                    <div className="hint" id="tp-m-label">
                        Minutos
                    </div>
                    {pickerTable(
                        mins,
                        pick.m,
                        (m) => setPick((p) => ({ ...p, m })),
                        "tpm-",
                        pick.fine ? 6 : mins.length,
                        "minutos",
                    )}
                    {!pick.fine && (
                        <button
                            type="button"
                            className="link tp-night"
                            id="tp-fine"
                            onClick={() => {
                                setPick((p) => ({ ...p, fine: true }));
                                focus("tpm-5");
                            }}
                        >
                            mais minutos (de 5 em 5)
                        </button>
                    )}
                </div>
                <div className="tp-result" aria-live="polite">
                    {time ? (
                        <>
                            Horário: <strong>{time}</strong>{" "}
                            <button
                                type="button"
                                className="link"
                                id="tp-clear"
                                onClick={() => {
                                    setPick(noPick);
                                    focus("time-btn");
                                }}
                            >
                                limpar
                            </button>
                        </>
                    ) : (
                        "Escolha a hora"
                    )}
                </div>
            </>
        );
    };

    const renderPanel = (task: Task, idx: number) => {
        const movable = movableFor(tasks, dayIso(idx));
        const pos = movable.findIndex((t) => t.id === task.id);
        return (
            <div className="task-panel" id={`panel-${task.id}`}>
                {task.note && <p className="task-note">{task.note}</p>}
                <button
                    type="button"
                    className="btn alt sm"
                    id={`ed-${task.id}`}
                    aria-label={`Editar ${task.text}`}
                    onClick={() => startEdit(task)}
                >
                    Editar
                </button>
                {pos > 0 && (
                    <button
                        type="button"
                        className="btn alt sm sq"
                        id={`up-${task.id}`}
                        aria-label={`Subir ${task.text}`}
                        title="Subir"
                        onClick={() => moveTask(task.id, idx, -1)}
                    >
                        ↑
                    </button>
                )}
                {pos >= 0 && pos < movable.length - 1 && (
                    <button
                        type="button"
                        className="btn alt sm sq"
                        id={`dn-${task.id}`}
                        aria-label={`Descer ${task.text}`}
                        title="Descer"
                        onClick={() => moveTask(task.id, idx, 1)}
                    >
                        ↓
                    </button>
                )}
                <button
                    type="button"
                    className="btn alt sm"
                    id={`rm-${task.id}`}
                    aria-label={`Remover ${task.text}`}
                    onClick={() => deleteTask(task)}
                >
                    Remover
                </button>
            </div>
        );
    };

    const renderTask = (task: Task, idx: number) => {
        if (editingId === task.id) {
            return (
                <form className="edit" key={task.id} onSubmit={(e) => submitEdit(e, task)}>
                    <label className="sr" htmlFor="edit-text">
                        Texto da tarefa
                    </label>
                    <input
                        type="text"
                        className="field"
                        id="edit-text"
                        value={editText}
                        maxLength={TEXT_MAX}
                        autoComplete="off"
                        onChange={(e) => setEditText(e.target.value)}
                    />
                    <label className="hint" htmlFor="edit-note">
                        Nota (opcional; aparece ao tocar no …)
                    </label>
                    <textarea
                        className="note-field"
                        id="edit-note"
                        rows={3}
                        maxLength={NOTE_MAX}
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                    />
                    <div>{timeToggle}</div>
                    {timeOpen && timePicker()}
                    <div className="hint" id="edit-hint">
                        Repetir nos dias (nenhum = só neste dia):
                    </div>
                    {weekdayButtons(
                        editDays,
                        (d) => setEditDays((days) => toggleIn(days, d)),
                        "edit-day",
                        "edit-hint",
                    )}
                    <button type="submit" className="btn">
                        Salvar
                    </button>
                    <button type="button" className="btn alt" onClick={cancelEdit}>
                        Cancelar
                    </button>
                </form>
            );
        }
        const iso = dayIso(idx);
        const done = isDone(task, iso);
        const late = isLate(task, iso, today, clock);
        const showActions = actionsId === task.id;
        const repeat = task.recurringDays ? `Repete ${daysText(task.recurringDays)}` : null;
        return (
            <div key={task.id}>
                <div
                    className={cx("task", done && "done", task.id < 0 && "temp")}
                    id={`task-${task.id}`}
                >
                    <div className="task-cell">
                        <button
                            type="button"
                            className="task-main"
                            id={`tg-${task.id}`}
                            role="checkbox"
                            aria-checked={done}
                            onClick={() => toggleTask(task, idx)}
                        >
                            <span className="box" aria-hidden="true" />
                            <span className="label">{task.text}</span>
                            {task.note && (
                                <>
                                    <span className="note-ic" title="Tem nota">
                                        <NoteIcon />
                                    </span>
                                    <span className="sr">, tem nota</span>
                                </>
                            )}
                            {task.time && (
                                <span className="sr">
                                    , às {task.time}
                                    {late ? ", atrasada" : ""}
                                </span>
                            )}
                            {repeat && (
                                <>
                                    <span className="rec" aria-hidden="true" title={repeat}>
                                        ↻
                                    </span>
                                    <span className="sr">, {repeat.toLowerCase()}</span>
                                </>
                            )}
                        </button>
                    </div>
                    {task.time && (
                        <div className={cx("task-time", late && "late")} aria-hidden="true">
                            <span>{task.time}</span>
                        </div>
                    )}
                    <div className="task-actions">
                        <button
                            type="button"
                            className="small more"
                            id={`mo-${task.id}`}
                            aria-expanded={showActions}
                            aria-controls={`panel-${task.id}`}
                            aria-label={`Mais ações para ${task.text}`}
                            onClick={() => {
                                if (task.id < 0) return;
                                setActionsId(showActions ? null : task.id);
                            }}
                        >
                            …
                        </button>
                    </div>
                </div>
                {showActions && renderPanel(task, idx)}
            </div>
        );
    };

    // dia passado: só consulta. Sem botões, sem "…", sem gestos; feita/não feita em texto.
    const renderPastTask = (task: HistoryTask, iso: string) => {
        const done = isDone(task, iso);
        const repeat = task.recurringDays ? `Repete ${daysText(task.recurringDays)}` : null;
        return (
            <div key={task.id}>
                <div className={cx("task", done && "done")} id={`task-${task.id}`}>
                    <div className="task-cell">
                        <p className="task-main past">
                            <span className="box" aria-hidden="true" />
                            <span className="label">{task.text}</span>
                            <span className="sr">, {done ? "feita" : "não feita"}</span>
                            {task.time && <span className="sr">, às {task.time}</span>}
                            {repeat && (
                                <>
                                    <span className="rec" aria-hidden="true" title={repeat}>
                                        ↻
                                    </span>
                                    <span className="sr">, {repeat.toLowerCase()}</span>
                                </>
                            )}
                        </p>
                    </div>
                    {task.time && (
                        <div className="task-time" aria-hidden="true">
                            <span>{task.time}</span>
                        </div>
                    )}
                </div>
                {task.note && <p className="task-note past-note">{task.note}</p>}
            </div>
        );
    };

    const renderPastDay = (idx: number) => {
        const iso = dayIso(idx);
        const list = historyFor(pastTasks, iso);
        return (
            <section className="day open" id={`day-${idx}`} aria-labelledby={`dh-${idx}`} key={idx}>
                <p className="hint past-notice">Dia passado: só consulta</p>
                <h2 className="day-head" id={`dh-${idx}`} tabIndex={-1}>
                    {DAY_NAMES[weekday(iso)]}
                </h2>
                <div className="date" id="date-line">
                    {dateLine(iso, idx, clock)}
                </div>
                {historyReady && list.length === 0 && <p className="empty">Nada por aqui.</p>}
                {list.map((t) => renderPastTask(t, iso))}
            </section>
        );
    };

    const renderDay = (idx: number) => {
        if (idx < 0) return renderPastDay(idx);
        const iso = dayIso(idx);
        const dow = weekday(iso);
        const name = DAY_NAMES[dow];
        const open = idx === openIdx;

        if (!open) {
            const count = pendingCount(tasks, iso);
            return (
                <section className="day" id={`day-${idx}`} aria-labelledby={`dh-${idx}`} key={idx}>
                    <h2 className="day-title">
                        <button
                            type="button"
                            className="day-head"
                            id={`dh-${idx}`}
                            aria-expanded="false"
                            onClick={(e) => openDay(idx, e.currentTarget)}
                        >
                            {name}
                            {idx === 0 ? (
                                <span className="tag">hoje</span>
                            ) : (
                                <span className="dd">{shortDate(iso)}</span>
                            )}
                            {count > 0 && (
                                <span className="count">
                                    {count}
                                    <span className="sr">
                                        {" "}
                                        {count === 1 ? "tarefa pendente" : "tarefas pendentes"}
                                    </span>
                                </span>
                            )}
                        </button>
                    </h2>
                </section>
            );
        }

        const list = tasksFor(tasks, iso);
        return (
            <section className="day open" id={`day-${idx}`} aria-labelledby={`dh-${idx}`} key={idx}>
                <h2 className="day-head" id={`dh-${idx}`} tabIndex={-1}>
                    {name}
                </h2>
                <div className="date" id="date-line">
                    {dateLine(iso, idx, clock)}
                </div>
                {list.length === 0 && <p className="empty">Nada por aqui.</p>}
                {list.map((t) => renderTask(t, idx))}
                <form className="add" onSubmit={submitAdd}>
                    <label className="sr" htmlFor="add-text">
                        Nova tarefa para {DAY_FULL[dow]}
                    </label>
                    <input
                        type="text"
                        className="field"
                        id="add-text"
                        placeholder="Adicionar tarefa..."
                        autoComplete="off"
                        maxLength={TEXT_MAX}
                        value={addText}
                        onChange={(e) => setAddText(e.target.value)}
                    />
                    {timeOpen && editingId === null && timePicker()}
                    {addRepeat && (
                        <>
                            <div className="hint" id="add-hint">
                                Repetir toda semana nos dias:
                            </div>
                            {weekdayButtons(
                                repeatDays,
                                (d) => setRepeatDays((days) => toggleIn(days, d)),
                                "add-day",
                                "add-hint",
                            )}
                        </>
                    )}
                    <button type="submit" className="btn">
                        Adicionar
                    </button>
                    {editingId === null && timeToggle}
                    <button
                        type="button"
                        className={cx("btn alt", addRepeat && "on")}
                        id="repeat-btn"
                        aria-pressed={addRepeat}
                        onClick={() => {
                            setRepeatDays(addRepeat ? [] : [dow]);
                            setAddRepeat(!addRepeat);
                        }}
                    >
                        ↻ Repetir
                    </button>
                </form>
            </section>
        );
    };

    const renderCalendar = () => {
        const [sy, sm] = since.split("-").map(Number) as [number, number];
        // "‹" vai até o mês em que a conta foi criada
        const atFirst = cal.y * 12 + cal.m <= sy * 12 + sm - 1;
        return (
            <>
                <div className="back-nav">
                    <button type="button" className="link" id="back-btn" onClick={backToList}>
                        voltar
                    </button>
                </div>
                <section className="cal" id="cal" aria-labelledby="cal-title">
                    <div className="cal-center">
                        <table className="cal-grid">
                            <thead>
                                <tr>
                                    {DAY_SHORT.map((s, w) => (
                                        <th scope="col" key={w}>
                                            <abbr title={DAY_FULL[w]}>{s}</abbr>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {monthGrid(cal.y, cal.m).map((week, w) => (
                                    <tr key={w}>
                                        {week.map((iso, d) => {
                                            if (!iso) {
                                                return (
                                                    <td key={d}>
                                                        {week.every((x) => !x) && (
                                                            <span className="cal-pad" />
                                                        )}
                                                    </td>
                                                );
                                            }
                                            const past = iso < today;
                                            const blocked = iso < since;
                                            const isToday = iso === today;
                                            const dot = !past && hasPendingOn(tasks, iso);
                                            const trace =
                                                past && !blocked && hasHistoryOn(pastTasks, iso);
                                            const day = Number(iso.slice(8));
                                            const label =
                                                `${day} de ${MONTHS[cal.m]}, ${DAY_FULL[d]}` +
                                                (isToday ? ", hoje" : "") +
                                                (dot ? ", com tarefas" : "") +
                                                (trace ? ", com histórico" : "");
                                            return (
                                                <td key={d}>
                                                    <button
                                                        type="button"
                                                        className={cx(
                                                            "cal-day",
                                                            isToday && "today",
                                                        )}
                                                        id={`cd-${iso}`}
                                                        aria-label={label}
                                                        disabled={blocked}
                                                        onClick={() => pickDate(iso)}
                                                    >
                                                        {day}
                                                        {(dot || trace) && (
                                                            <span
                                                                className={cx(
                                                                    "dot",
                                                                    trace && "past",
                                                                )}
                                                                aria-hidden="true"
                                                            />
                                                        )}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
                <div className="cal-bar" id="cal-bar">
                    <div className="cal-head">
                        <span className="cal-cell">
                            <button
                                type="button"
                                className="cal-arrow"
                                id="cal-prev"
                                aria-label="Mês anterior"
                                disabled={atFirst}
                                onClick={() => changeMonth(-1)}
                            >
                                ‹
                            </button>
                        </span>
                        <h2 className="cal-title" id="cal-title" tabIndex={-1} aria-live="polite">
                            {MONTHS[cal.m]!.toUpperCase()} {cal.y}
                        </h2>
                        <span className="cal-cell right">
                            <button
                                type="button"
                                className="cal-arrow"
                                id="cal-next"
                                aria-label="Próximo mês"
                                onClick={() => changeMonth(1)}
                            >
                                ›
                            </button>
                        </span>
                    </div>
                </div>
            </>
        );
    };

    // o calendário ocupa a altura que sobra na tela, para ficar no meio dela
    useLayoutEffect(() => {
        if (view !== "calendar") return;
        const fit = () => {
            const el = document.getElementById("cal");
            if (!el) return;
            el.style.height = "";
            const zoom = Number(getComputedStyle(el.closest(".app")!).zoom) || 1;
            const top = el.getBoundingClientRect().top + window.scrollY;
            const bar = document.getElementById("cal-bar")?.offsetHeight ?? 0;
            const free = window.innerHeight / zoom - top / zoom - bar;
            if (free > el.offsetHeight) el.style.height = `${free}px`;
        };
        fit();
        window.addEventListener("resize", fit);
        return () => window.removeEventListener("resize", fit);
    }, [view, cal, fontStep]);

    const themeLabel = dark ? "Mudar para tema claro" : "Mudar para tema escuro";

    return (
        <>
            <div className="app">
                <header className="topbar">
                    <Wordmark />
                    <div className="top-actions">
                        <button
                            type="button"
                            className="icon-btn a-sm"
                            id="font-down"
                            aria-label="Diminuir letra"
                            title="Diminuir letra"
                            disabled={fontStep === 0}
                            onClick={() => changeFont(-1)}
                        >
                            A
                        </button>
                        <button
                            type="button"
                            className="icon-btn a-lg"
                            id="font-up"
                            aria-label="Aumentar letra"
                            title="Aumentar letra"
                            disabled={fontStep === FONT_STEPS - 1}
                            onClick={() => changeFont(1)}
                        >
                            A
                        </button>
                        <button
                            type="button"
                            className="icon-btn"
                            id="theme-btn"
                            aria-label={themeLabel}
                            title={themeLabel}
                            onClick={toggleTheme}
                        >
                            <ThemeIcon />
                        </button>
                        <form action={signOut}>
                            <button type="submit" className="link">
                                sair
                            </button>
                        </form>
                    </div>
                </header>
                <div
                    id="status"
                    className={cx("status", error && "error")}
                    role="status"
                    aria-live="polite"
                >
                    {error && <span>{error}</span>}
                </div>
                {view === "calendar" ? (
                    <main>{renderCalendar()}</main>
                ) : view === "day" ? (
                    <>
                        <div className="back-nav">
                            <button
                                type="button"
                                className="link"
                                id="back-btn"
                                onClick={backToCalendar}
                            >
                                calendário
                            </button>
                        </div>
                        <main>{renderDay(openIdx)}</main>
                    </>
                ) : (
                    <main>
                        {Array.from({ length: 7 }, (_, i) => renderDay(i))}
                        <section className="day cal-band">
                            <h2 className="day-title">
                                <button
                                    type="button"
                                    className="day-head"
                                    id="cal-open"
                                    onClick={() => {
                                        const [y, m] = today.split("-").map(Number) as [
                                            number,
                                            number,
                                        ];
                                        openCalendar(y, m - 1);
                                        focus("cal-title");
                                    }}
                                >
                                    CALENDÁRIO
                                </button>
                            </h2>
                        </section>
                    </main>
                )}
            </div>
            <div className="toast-host" role="status" aria-live="polite">
                {pending && (
                    <div className="toast">
                        <div className="toast-inner">
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
                    </div>
                )}
            </div>
        </>
    );
}
