import { ExternalIntegrations } from "@/components/integrations/ExternalIntegrations";
import { useTranslation } from "react-i18next";

const IntegrationsPage = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t('integrations.title')}</h2>
      </div>
      <ExternalIntegrations />
    </div>
  );
};

export default IntegrationsPage; 