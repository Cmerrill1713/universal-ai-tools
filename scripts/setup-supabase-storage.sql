-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('models', 'models', false, 10737418240, array['application/octet-stream', 'application/json', 'text/plain']),
  ('documents', 'documents', false, 52428800, array['text/plain', 'application/pdf', 'application/json', 'text/markdown']),
  ('embeddings', 'embeddings', false, 104857600, array['application/octet-stream', 'application/json']),
  ('conversations', 'conversations', false, 10485760, array['application/json', 'text/plain']),
  ('training-data', 'training-data', false, 1073741824, array['application/json', 'text/plain', 'text/csv'])
ON CONFLICT (id) DO NOTHING;