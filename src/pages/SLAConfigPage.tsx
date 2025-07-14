import { SLAConfiguration } from "@/components/admin/SLAConfiguration";
import { useTranslation } from 'react-i18next';

const SLAConfigPage = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t('navigation.adminSla')}</h2>
      </div>
      <SLAConfiguration />
    </div>
  );
};

export default SLAConfigPage; 