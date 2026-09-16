import { PageHeader } from "@/components/ui/primitives";
import { TaskForm } from "@/components/tasks/task-form";

export default function NewTaskPage() {
  return (
    <div>
      <PageHeader title="Nueva tarea" />
      <TaskForm />
    </div>
  );
}
