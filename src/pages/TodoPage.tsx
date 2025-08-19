import { TodoList } from "@/components/todo/TodoList";
import { useTranslation } from "react-i18next";

const TodoPage = () => {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white">
          {t('todo.manageTitle')}
        </h2>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
          {t('todo.manageDesc')}
        </p>
      </div>
      <TodoList />
    </div>
  );
};

export default TodoPage; 