import { SLAConfiguration } from "@/components/admin/SLAConfiguration";

const SLAConfigPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">SLA Configuration</h2>
      </div>
      <SLAConfiguration />
    </div>
  );
};

export default SLAConfigPage; 