-- Helper function to get assigned agent of a ticket
CREATE OR REPLACE FUNCTION public.assigned_agent(p_ticket_id uuid)
RETURNS uuid AS $$
  SELECT assigned_to FROM public.tickets_new WHERE id = p_ticket_id;
$$ LANGUAGE SQL STABLE;

-- Policy: only ticket requester, assigned agent, or admin may insert comments
ALTER TABLE public.ticket_comments_new ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restricted comment insert" ON public.ticket_comments_new;

CREATE POLICY "Restricted comment insert" ON public.ticket_comments_new
FOR INSERT WITH CHECK (
  -- requester
  auth.uid() = (SELECT user_id FROM public.tickets_new WHERE id = ticket_id) OR
  -- assigned agent
  auth.uid() = public.assigned_agent(ticket_id) OR
  -- admin role
  EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
); 