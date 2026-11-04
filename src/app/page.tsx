import "server-only";
import { requireUser } from "@/app/_auth/session";
import { todayIn } from "@/domain/tasks";
import { createDb } from "@/infrastructure/db/client";
import { DrizzleTasksRepository } from "@/infrastructure/db/tasks-repository";
import { Week } from "@/app/_components/Week";

export default async function Home() {
    const user = await requireUser();
    const today = todayIn(user.timeZone, new Date());
    const repo = new DrizzleTasksRepository(createDb());
    const [tasks, since] = await Promise.all([repo.list(user.id, today), repo.since(user.id)]);
    return (
        <Week
            today={today}
            timeZone={user.timeZone}
            tasks={tasks}
            since={since ?? today}
            email={user.email}
        />
    );
}
