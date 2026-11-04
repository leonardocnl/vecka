// Regras das tarefas, portadas de legacy/index.html. Puras: datas são strings "AAAA-MM-DD",
// horários "HH:MM", e toda conta de calendário é feita em UTC (sem horário de verão no caminho).

export const TEXT_MAX = 300;
export const NOTE_MAX = 1000;
export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
export const WEEK_LENGTH = 7;

export const DAY_NAMES = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
export const DAY_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];
/** Abreviações do dial e da recorrência (Space Mono). */
export const DAY_ABBR = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
export const DAY_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const MONTHS = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
];

export const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export type Task = {
    id: number;
    text: string;
    /** avulsa: o dia dela; recorrente: null */
    date: string | null;
    /** recorrente: dias da semana (0 = domingo); avulsa: null */
    recurringDays: number[] | null;
    time: string | null;
    note: string | null;
    /** ordem manual entre as sem horário (↑ ↓) */
    position: number;
    /** dias em que foi concluída */
    doneDates: string[];
};

// ---------- datas e fuso ----------

const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];
const utc = (iso: string) => {
    const [y, m, d] = parts(iso);
    return Date.UTC(y, m - 1, d);
};
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Confere que a data existe (31/02 não). */
export const isValidDate = (iso: string): boolean => ISO_DATE.test(iso) && toIso(utc(iso)) === iso;

export const addDays = (iso: string, n: number): string => toIso(utc(iso) + n * 86_400_000);
export const daysBetween = (from: string, to: string): number =>
    Math.round((utc(to) - utc(from)) / 86_400_000);
/** 0 = domingo */
export const weekday = (iso: string): number => new Date(utc(iso)).getUTCDay();

function zoned(timeZone: string, now: Date) {
    const values = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        })
            .formatToParts(now)
            .map((p) => [p.type, p.value]),
    );
    return {
        date: `${values.year}-${values.month}-${values.day}`,
        time: `${values.hour}:${values.minute}`,
    };
}

/** "Hoje" no fuso do usuário. */
export const todayIn = (timeZone: string, now: Date): string => zoned(timeZone, now).date;
/** A hora "HH:MM" no fuso do usuário. */
export const clockIn = (timeZone: string, now: Date): string => zoned(timeZone, now).time;

export const isValidTimeZone = (timeZone: string): boolean => {
    try {
        new Intl.DateTimeFormat("en", { timeZone });
        return true;
    } catch {
        return false;
    }
};

/** Hoje + 6 dias. */
export const weekDates = (today: string): string[] =>
    Array.from({ length: WEEK_LENGTH }, (_, i) => addDays(today, i));

// ---------- tarefas de um dia ----------

export const appliesOn = (task: Task, iso: string): boolean =>
    task.recurringDays ? task.recurringDays.includes(weekday(iso)) : task.date === iso;

export const isDone = (task: Task, iso: string): boolean => task.doneDates.includes(iso);

const stable = <T>(list: T[], key: (item: T) => number | string) =>
    list
        .map((item, i) => ({ item, i }))
        .sort((a, b) => {
            const x = key(a.item);
            const y = key(b.item);
            return x < y ? -1 : x > y ? 1 : a.i - b.i;
        })
        .map(({ item }) => item);

/** Ordem do dia: com horário (crescente) → sem horário (ordem manual) → feitas. */
export function tasksFor(tasks: readonly Task[], iso: string): Task[] {
    const day = tasks.filter((t) => appliesOn(t, iso));
    const todo = day.filter((t) => !isDone(t, iso));
    const done = day.filter((t) => isDone(t, iso));
    return [
        ...stable(
            todo.filter((t) => t.time),
            (t) => t.time!,
        ),
        ...stable(
            todo.filter((t) => !t.time),
            (t) => t.position,
        ),
        ...done,
    ];
}

/** As que podem subir e descer: sem horário e não feitas, na ordem da tela. */
export const movableFor = (tasks: readonly Task[], iso: string): Task[] =>
    tasksFor(tasks, iso).filter((t) => !t.time && !isDone(t, iso));

export const pendingCount = (tasks: readonly Task[], iso: string): number =>
    tasksFor(tasks, iso).filter((t) => !isDone(t, iso)).length;

/** Só hoje, tarefa não feita com horário já passado. */
export const isLate = (task: Task, iso: string, today: string, clock: string): boolean =>
    iso === today && !!task.time && task.time < clock && !isDone(task, iso);

/** Ponto no calendário: tarefa avulsa ainda não feita naquele dia. */
export const hasPendingOn = (tasks: readonly Task[], iso: string): boolean =>
    tasks.some((t) => !t.recurringDays && t.date === iso && !isDone(t, iso));

/**
 * Troca a posição com a vizinha de cima (-1) ou de baixo (1). Devolve as duas novas posições, ou
 * null se não há vizinha.
 */
export function swapPositions(
    tasks: readonly Task[],
    iso: string,
    id: number,
    dir: -1 | 1,
): [{ id: number; position: number }, { id: number; position: number }] | null {
    const list = movableFor(tasks, iso);
    const i = list.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return null;
    const a = list[i]!;
    const b = list[j]!;
    let pb = b.position;
    if (a.position === pb) pb = a.position + dir;
    return [
        { id: a.id, position: pb },
        { id: b.id, position: a.position },
    ];
}

export const toggleIn = (list: readonly number[], value: number): number[] =>
    (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]).sort();

// ---------- histórico (dias passados, só consulta) ----------

/** Tarefa lida do histórico: o dia (no fuso do usuário) em que foi criada. */
export type HistoryTask = Task & { createdOn: string };

/**
 * O que aparece num dia passado: avulsas daquela data e recorrentes que caem naquele dia da
 * semana, só a partir do dia em que foram criadas. Removidas nem chegam aqui (o servidor as
 * descarta). Feita = há conclusão naquela data. Mesma ordem das outras telas.
 */
export const historyFor = (tasks: readonly HistoryTask[], iso: string): HistoryTask[] =>
    tasksFor(
        tasks.filter((t) => !t.recurringDays || t.createdOn <= iso),
        iso,
    ) as HistoryTask[];

/** Ponto cinza no calendário: o dia passado tem alguma tarefa. */
export const hasHistoryOn = (tasks: readonly HistoryTask[], iso: string): boolean =>
    historyFor(tasks, iso).length > 0;

/** O primeiro e o último dia do mês (month 0–11). */
export const monthRange = (year: number, month: number): { from: string; to: string } => ({
    from: toIso(Date.UTC(year, month, 1)),
    to: toIso(Date.UTC(year, month + 1, 0)),
});

// ---------- textos ----------

const pad = (n: number) => String(n).padStart(2, "0");

/** [1, 3, 5] → "segunda, quarta e sexta" */
export function daysText(days: readonly number[]): string {
    if (days.length === 7) return "todos os dias";
    const names = days.map((d) => DAY_FULL[d]!);
    if (names.length === 1) return names[0]!;
    return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** Ao lado das placas: "novembro · 14:35" (hoje) / "· amanhã" / "· em 5 dias" / "· ontem" / "· há 5 dias". */
export function dialLine(iso: string, idx: number, clock: string): string {
    const month = MONTHS[parts(iso)[1] - 1];
    const when =
        idx === 0
            ? clock
            : idx === 1
              ? "amanhã"
              : idx === -1
                ? "ontem"
                : idx > 1
                  ? `em ${idx} dias`
                  : `há ${-idx} dias`;
    return `${month} · ${when}`;
}

/** "4 de novembro de 2026" (rótulo das placas de virar). */
export function fullDate(iso: string): string {
    const [y, m, d] = parts(iso);
    return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** Etiqueta da recorrente: "↻ DIÁRIO" ou "↻ SEG QUA" (na ordem da semana). */
export const recurrenceTag = (days: readonly number[]): string =>
    `↻ ${
        days.length === 7
            ? "DIÁRIO"
            : [...days]
                  .sort()
                  .map((d) => DAY_ABBR[d])
                  .join(" ")
    }`;

/** "31/10" */
export const shortDate = (iso: string): string => {
    const [, m, d] = parts(iso);
    return `${pad(d)}/${pad(m)}`;
};

// ---------- calendário ----------

/** Quantos dias do mês, de hoje em diante, têm ponto de pendente (avulsa não feita). */
export function pendingDaysIn(tasks: readonly Task[], year: number, month: number, today: string) {
    return monthGrid(year, month)
        .flat()
        .filter((iso): iso is string => !!iso && iso >= today && hasPendingOn(tasks, iso)).length;
}

/** O mês em 6 semanas começando no domingo: datas do mês ou null nas casas vazias. */
export function monthGrid(year: number, month: number): (string | null)[][] {
    const first = Date.UTC(year, month, 1);
    const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const offset = new Date(first).getUTCDay();
    const cells = Array.from({ length: 42 }, (_, i) => {
        const day = i - offset + 1;
        return day >= 1 && day <= days ? toIso(Date.UTC(year, month, day)) : null;
    });
    return Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export const pad2 = pad;
