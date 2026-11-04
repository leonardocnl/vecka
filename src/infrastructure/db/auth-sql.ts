import { sql } from "drizzle-orm";
import {
    SESSION_ABSOLUTE_DAYS,
    SESSION_RENEW_AFTER_MINUTES,
    SESSION_SLIDING_DAYS,
} from "@/domain/auth";

// As instruções das contas, sem imports do Next: o teste de ataque roda estas mesmas instruções
// contra um Postgres de verdade (auth.db.test.ts). Toda leitura de sessão parte do hash do token;
// nenhuma aceita id de usuário vindo de fora. O relógio é sempre o do banco (now()).

const sliding = sql.raw(`interval '${SESSION_SLIDING_DAYS} days'`);
const absolute = sql.raw(`interval '${SESSION_ABSOLUTE_DAYS} days'`);
const renewAfter = sql.raw(`interval '${SESSION_RENEW_AFTER_MINUTES} minutes'`);

/** Cria ou atualiza a conta pelo `sub` do Google. */
export const upsertUser = (p: { googleSub: string; email: string; name: string }) => sql`
    insert into users (google_sub, email, name) values (${p.googleSub}, ${p.email}, ${p.name})
    on conflict (google_sub) do update set email = excluded.email, name = excluded.name
    returning id`;

/** Apaga as sessões vencidas da conta (roda a cada login). */
export const purgeExpiredSessions = (userId: number) => sql`
    delete from user_sessions
    where user_id = ${userId} and (expires_at <= now() or absolute_expires_at <= now())`;

/** Sessão nova: token novo a cada login. */
export const createSession = (userId: number, tokenHash: string) => sql`
    insert into user_sessions (user_id, token_hash, expires_at, absolute_expires_at)
    values (${userId}, ${tokenHash}, now() + ${sliding}, now() + ${absolute})
    returning id`;

/** A conta da sessão viva, com o que a tela mostra. Vencida (inatividade ou teto) = nenhuma linha. */
export const sessionUser = (tokenHash: string) => sql`
    select u.id, u.email, u.name, u.time_zone as "timeZone", s.last_used_at < now() - ${renewAfter} as stale
    from user_sessions s join users u on u.id = s.user_id
    where s.token_hash = ${tokenHash} and s.expires_at > now() and s.absolute_expires_at > now()`;

/** Renova a inatividade, sem passar do teto absoluto. */
export const renewSession = (tokenHash: string) => sql`
    update user_sessions
    set last_used_at = now(), expires_at = least(now() + ${sliding}, absolute_expires_at)
    where token_hash = ${tokenHash} and expires_at > now() and absolute_expires_at > now()`;

export const deleteSession = (tokenHash: string) =>
    sql`delete from user_sessions where token_hash = ${tokenHash}`;
