import { sql, type SQL } from "drizzle-orm";

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
