import { SLAConfiguration } from "@/components/admin/SLAConfiguration";

const SLAConfigPage = () => {
  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white">SLA Configuration</h2>
      </div>
      <SLAConfiguration />
    </div>
  );
};

export default SLAConfigPage; 