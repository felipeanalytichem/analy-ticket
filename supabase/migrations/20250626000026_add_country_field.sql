-- Add country field to tickets table
ALTER TABLE tickets ADD COLUMN country text;

-- Add comment to the column
COMMENT ON COLUMN tickets.country IS 'The country where the ticket was created from';

-- Update RLS policies to include the new field
ALTER POLICY "Users can view their own tickets" ON tickets 
  USING (auth.uid() = user_id);

ALTER POLICY "Agents can view all tickets" ON tickets 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('agent', 'admin')
    )
  );

ALTER POLICY "Users can create tickets" ON tickets 
  WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Agents can update assigned tickets" ON tickets 
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('agent', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('agent', 'admin')
    )
  ); 