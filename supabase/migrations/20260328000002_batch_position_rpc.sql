-- RPC: batch update service positions in a single transaction
-- Replaces N individual UPDATE calls from the drag-and-drop reorder
CREATE OR REPLACE FUNCTION public.batch_update_service_positions(
  updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE public.services
    SET position = (item->>'position')::int,
        updated_at = now()
    WHERE id = (item->>'id')::uuid;
  END LOOP;
END;
$$;

-- Only authenticated users can call this
REVOKE EXECUTE ON FUNCTION public.batch_update_service_positions(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.batch_update_service_positions(jsonb) TO authenticated;
