-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table for intelligent splicing functionality
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create vector index for similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON documents USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Create text search index
CREATE INDEX IF NOT EXISTS documents_content_idx 
ON documents USING gin(to_tsvector('english', left(content, 300000)));

-- Create title index
CREATE INDEX IF NOT EXISTS documents_title_idx 
ON documents (title);

-- Create metadata index
CREATE INDEX IF NOT EXISTS documents_metadata_idx 
ON documents USING gin(metadata);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO documents (title, content, metadata) VALUES 
('Sample Document 1', 'This is a sample document for testing the intelligent splicing functionality.', '{"category": "test", "priority": "high"}'),
('Sample Document 2', 'Another sample document with different content for vector similarity testing.', '{"category": "test", "priority": "medium"}')
ON CONFLICT DO NOTHING;
