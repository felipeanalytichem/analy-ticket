-- Add feedback system for tickets
-- This migration adds ticket feedback functionality

-- Create feedback table
CREATE TABLE IF NOT EXISTS public.ticket_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES public.tickets_new(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    satisfaction TEXT NOT NULL CHECK (satisfaction IN ('satisfied', 'neutral', 'unsatisfied')),
    comment TEXT,
    categories TEXT[], -- Array of positive feedback categories
    agent_name TEXT, -- Store agent name at time of feedback
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ticket_id, user_id) -- One feedback per ticket per user
);

-- RLS Policies for feedback table
ALTER TABLE public.ticket_feedback ENABLE ROW LEVEL SECURITY;

-- Users can view feedback for their own tickets
CREATE POLICY "Users can view feedback for their tickets" ON public.ticket_feedback
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.tickets_new t
            WHERE t.id = ticket_id AND (
                t.user_id = auth.uid() OR 
                t.assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() AND role IN ('agent', 'admin')
                )
            )
        )
    );

-- Users can create feedback for their own tickets
CREATE POLICY "Users can create feedback for their tickets" ON public.ticket_feedback
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.tickets_new t
            WHERE t.id = ticket_id AND t.user_id = auth.uid()
        )
    );

-- Users can update their own feedback
CREATE POLICY "Users can update their own feedback" ON public.ticket_feedback
    FOR UPDATE USING (user_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_ticket_feedback_updated_at BEFORE UPDATE ON public.ticket_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_ticket_feedback_ticket_id ON public.ticket_feedback(ticket_id);
CREATE INDEX idx_ticket_feedback_user_id ON public.ticket_feedback(user_id);
CREATE INDEX idx_ticket_feedback_rating ON public.ticket_feedback(rating);
CREATE INDEX idx_ticket_feedback_satisfaction ON public.ticket_feedback(satisfaction);

-- Add feedback_received field to tickets table to track if feedback was received
ALTER TABLE public.tickets_new 
ADD COLUMN IF NOT EXISTS feedback_received BOOLEAN DEFAULT FALSE;

-- Function to get feedback statistics
CREATE OR REPLACE FUNCTION get_feedback_statistics(agent_uuid UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_feedback', COUNT(*),
        'average_rating', ROUND(AVG(rating)::numeric, 2),
        'satisfaction_breakdown', json_build_object(
            'satisfied', COUNT(*) FILTER (WHERE satisfaction = 'satisfied'),
            'neutral', COUNT(*) FILTER (WHERE satisfaction = 'neutral'),
            'unsatisfied', COUNT(*) FILTER (WHERE satisfaction = 'unsatisfied')
        ),
        'rating_breakdown', json_build_object(
            'rating_5', COUNT(*) FILTER (WHERE rating = 5),
            'rating_4', COUNT(*) FILTER (WHERE rating = 4),
            'rating_3', COUNT(*) FILTER (WHERE rating = 3),
            'rating_2', COUNT(*) FILTER (WHERE rating = 2),
            'rating_1', COUNT(*) FILTER (WHERE rating = 1)
        )
    ) INTO result
    FROM public.ticket_feedback
    WHERE agent_uuid IS NULL OR agent_name = (
        SELECT full_name FROM public.users WHERE id = agent_uuid
    );
    
    RETURN COALESCE(result, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 