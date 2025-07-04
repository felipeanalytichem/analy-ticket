import { KnowledgeBaseAdmin } from "@/components/admin/knowledge/KnowledgeBaseAdmin";
import { useAuth } from "@/contexts/AuthContext";

const KnowledgeAdminPage = () => {
  const { userProfile } = useAuth();
  const userRole = userProfile?.role as "user" | "agent" | "admin" || "user";

  return (
    <div className="space-y-6">
      <KnowledgeBaseAdmin userRole={userRole} userId={userProfile?.id || ""} />
    </div>
  );
};

export default KnowledgeAdminPage; 