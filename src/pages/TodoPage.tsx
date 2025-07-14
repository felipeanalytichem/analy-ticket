import { TodoList } from "@/components/todo/TodoList";
import { useTranslation } from 'react-i18next';

const TodoPage = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t('todo.manageTitle')}</h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('todo.manageDesc')}
        </p>
      </div>
      <TodoList />
    </div>
  );
};

export default TodoPage; 