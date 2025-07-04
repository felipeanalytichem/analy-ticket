export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  created_by: string;
  assigned_to: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  category: string | null;
  category_id: string | null;
  department: string | null;
  due_date: string | null;
  tags: string[] | null;
  custom_fields: Record<string, any> | null;
  followers: Array<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }> | null;
  country: string | null;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: 'user' | 'agent' | 'admin' | null;
  avatar_url: string | null;
  department: string | null;
}
