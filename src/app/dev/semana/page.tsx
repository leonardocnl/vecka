import { notFound } from "next/navigation";
import { addDays, DEFAULT_TIME_ZONE, todayIn, type Task } from "@/domain/tasks";
import { Week } from "@/app/_components/Week";

// Só no desenvolvimento: a semana com dados fictícios, sem banco, para conferir o visual (e tirar
// as capturas dos PRs). Em produção é 404. As ações do servidor recusam (sessão falsa).
export default function DevWeek() {
    if (process.env.NODE_ENV === "production") notFound();
    const today = todayIn(DEFAULT_TIME_ZONE, new Date());
    const task = (id: number, text: string, extra: Partial<Task> = {}): Task => ({
        id,
        text,
        date: today,
        recurringDays: null,
        time: null,
        note: null,
        position: id,
        doneDates: [],
        ...extra,
    });
    const tasks = [
        task(1, "Treino", { recurringDays: [1, 3, 5], time: "07:00", doneDates: [today] }),
        task(2, "Reunião com a equipe", { time: "00:30" }),
        task(3, "Dentista", { time: "23:30", note: "Rua das Flores, 120. Levar a carteirinha." }),
        task(4, "Comprar pão e café para a semana inteira, sem esquecer o filtro"),
        task(5, "Ler 20 páginas", { recurringDays: [0, 1, 2, 3, 4, 5, 6] }),
        task(6, "Pagar a conta de luz", { date: addDays(today, 2), time: "10:00" }),
        task(7, "Ligar para a vó", { date: addDays(today, 12) }),
    ];
    return (
        <Week
            today={today}
            timeZone={DEFAULT_TIME_ZONE}
            tasks={tasks}
            since={addDays(today, -40)}
            email="leitor@exemplo.com"
        />
    );
}
