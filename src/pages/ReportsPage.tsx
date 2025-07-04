import { ReportExporter } from "@/components/reports/ReportExporter";
import { useTranslation } from "react-i18next";

const ReportsPage = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t('reports.title')}</h2>
      </div>
      <ReportExporter />
    </div>
  );
};

export default ReportsPage; 