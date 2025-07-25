import { TodoList } from "@/components/todo/TodoList";

const TodoPage = () => {
  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white">To-Do List</h2>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
          Manage your ticket-related tasks
        </p>
      </div>
      <TodoList />
    </div>
  );
};

export default TodoPage; 