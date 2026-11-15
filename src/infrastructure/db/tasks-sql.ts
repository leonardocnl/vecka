import { sql, type SQL } from "drizzle-orm";
import type { ExternalTask } from "@/application/integrations";

// As instruções das tarefas, sem imports do Next (o teste de ataque as roda num Postgres de
// verdade). TODA instrução filtra por user_id, que vem sempre da sessão: tarefa de outro usuário
// se comporta como inexistente. Tarefa apagada (deleted_at) também.

const days = (list: readonly number[] | null): SQL =>
    list
        ? sql`array[${sql.join(
              list.map((d) => sql`${d}`),
              sql`, `,
          )}]::smallint[]`
        : sql`null`;

const columns = sql`t.id, t.text, to_char(t.date, 'YYYY-MM-DD') as date,
    to_json(t.recurring_days) as "recurringDays", t.time, t.note, t.position`;

/** As tarefas que ainda aparecem (recorrentes e avulsas de hoje em diante), com as conclusões. */
export const listTasks = (userId: number, today: string) => sql`
    select ${columns},
        coalesce((
            select json_agg(to_char(c.date, 'YYYY-MM-DD') order by c.date)
            from task_completions c where c.task_id = t.id and c.date >= ${today}::date
        ), '[]'::json) as "doneDates"
    from tasks t
    where t.user_id = ${userId} and t.deleted_at is null
        and (t.recurring_days is not null or t.date >= ${today}::date)
    order by t.id`;

export const getTask = (userId: number, id: number) => sql`
    select ${columns} from tasks t
    where t.id = ${id} and t.user_id = ${userId} and t.deleted_at is null`;

export const insertTask = (
    userId: number,
    p: { text: string; date: string | null; days: number[] | null; time: string | null },
) => sql`
    insert into tasks (user_id, text, date, recurring_days, time, position)
    values (${userId}, ${p.text}, ${p.date}::date, ${days(p.days)}, ${p.time},
        extract(epoch from clock_timestamp()))
    returning id`;

export const updateTask = (
    userId: number,
    id: number,
    p: {
        text: string;
        date: string | null;
        days: number[] | null;
        time: string | null;
        note: string | null;
    },
) => sql`
    update tasks set text = ${p.text}, date = ${p.date}::date, recurring_days = ${days(p.days)},
        time = ${p.time}, note = ${p.note}
    where id = ${id} and user_id = ${userId} and deleted_at is null
    returning id`;

export const setPosition = (userId: number, id: number, position: number) => sql`
    update tasks set position = ${position}
    where id = ${id} and user_id = ${userId} and deleted_at is null
    returning id`;

export const softDeleteTask = (userId: number, id: number) => sql`
    update tasks set deleted_at = now()
    where id = ${id} and user_id = ${userId} and deleted_at is null
    returning id`;

export const markDone = (userId: number, id: number, date: string) => sql`
    insert into task_completions (task_id, date)
    select t.id, ${date}::date from tasks t
    where t.id = ${id} and t.user_id = ${userId} and t.deleted_at is null
    on conflict do nothing`;

export const markUndone = (userId: number, id: number, date: string) => sql`
    delete from task_completions c using tasks t
    where c.task_id = t.id and t.id = ${id} and t.user_id = ${userId} and t.deleted_at is null
        and c.date = ${date}::date`;

/**
 * Histórico de um intervalo (o mês visível): avulsas daquelas datas e recorrentes criadas até o
 * fim dele, com as conclusões do intervalo e o dia de criação no fuso do usuário. Removidas ficam
 * de fora. O intervalo já chega validado (datas reais, até 42 dias).
 */
export const listHistory = (userId: number, from: string, to: string) => sql`
    select ${columns},
        to_char((t.created_at at time zone u.time_zone)::date, 'YYYY-MM-DD') as "createdOn",
        coalesce((
            select json_agg(to_char(c.date, 'YYYY-MM-DD') order by c.date)
            from task_completions c
            where c.task_id = t.id and c.date between ${from}::date and ${to}::date
        ), '[]'::json) as "doneDates"
    from tasks t join users u on u.id = t.user_id
    where t.user_id = ${userId} and t.deleted_at is null
        and (t.date between ${from}::date and ${to}::date
            or (t.recurring_days is not null
                and (t.created_at at time zone u.time_zone)::date <= ${to}::date))
    order by t.id`;

/** O dia (no fuso do usuário) em que a conta foi criada: o limite do "‹" no calendário. */
export const accountSince = (userId: number) => sql`
    select to_char((created_at at time zone time_zone)::date, 'YYYY-MM-DD') as since
    from users where id = ${userId}`;

// ---------- integração (docs/integracoes.md) ----------
// O dono vem de INTEGRATION_USER_EMAIL, nunca do pedido; daí em diante tudo filtra pelo id dele.

/** A conta dona das tarefas da integração. E-mail repetido em duas contas = nenhuma (falha fechada). */
export const usersByEmail = (email: string) => sql`
    select id, time_zone as "timeZone" from users where lower(email) = lower(${email})
    order by id limit 2`;

export const findExternal = (userId: number, source: string, externalId: string) => sql`
    select t.id, to_char(t.date, 'YYYY-MM-DD') as date, t.deleted_at is not null as deleted
    from tasks t
    where t.user_id = ${userId} and t.external_source = ${source} and t.external_id = ${externalId}`;

export const insertExternal = (userId: number, p: ExternalTask) => sql`
    insert into tasks (user_id, external_source, external_id, text, date, time, note, url, position)
    values (${userId}, ${p.source}, ${p.externalId}, ${p.text}, ${p.date}::date, ${p.time},
        ${p.note}, ${p.url}, extract(epoch from clock_timestamp()))
    on conflict (user_id, external_source, external_id) where external_id is not null do nothing
    returning id`;

/** Grava só se algo mudou; sem linha de volta = nada mudou. A integração só cria avulsas. */
export const updateExternal = (userId: number, id: number, p: ExternalTask) => sql`
    update tasks set text = ${p.text}, date = ${p.date}::date, recurring_days = null,
        time = ${p.time}, note = ${p.note}, url = ${p.url}
    where id = ${id} and user_id = ${userId} and deleted_at is null
        and (text, date, recurring_days, time, note, url) is distinct from
            (${p.text}, ${p.date}::date, null::smallint[], ${p.time}::char(5), ${p.note}, ${p.url})
    returning id`;

/** A conclusão acompanha a tarefa quando a data muda: concluída continua concluída. */
export const moveCompletion = (userId: number, id: number, from: string, to: string) => sql`
    update task_completions c set date = ${to}::date
    from tasks t
    where c.task_id = t.id and t.id = ${id} and t.user_id = ${userId} and c.date = ${from}::date
        and not exists (
            select 1 from task_completions d where d.task_id = t.id and d.date = ${to}::date)`;

/** Pendentes de um dia: avulsas da data e recorrentes daquele dia da semana, sem conclusão nele. */
export const pendingOn = (userId: number, date: string) => sql`
    select t.id, t.text as title,
        case when t.time is null then null else to_char(
            ((${date}::date + t.time::time) at time zone u.time_zone) at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS"Z"') end as "dueAt",
        false as done, t.external_source as "externalSource"
    from tasks t join users u on u.id = t.user_id
    where t.user_id = ${userId} and t.deleted_at is null
        and (t.date = ${date}::date
            or (extract(dow from ${date}::date)::smallint = any(t.recurring_days)
                and (t.created_at at time zone u.time_zone)::date <= ${date}::date))
        and not exists (
            select 1 from task_completions c where c.task_id = t.id and c.date = ${date}::date)
    order by t.time nulls last, t.position, t.id`;
