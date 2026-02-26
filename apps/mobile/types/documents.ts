/**
 * Document-related TypeScript types — mirrors backend Pydantic schemas.
 */

export type DocumentStatus = "queued" | "processing" | "ready" | "failed";

export interface DocumentResponse {
  id: string;
  workspace_id: string;
  uploaded_by: string;
  title: string;
  file_size_bytes: number;
  file_type: string;
  chunk_count: number | null;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentUploaderResponse {
  id: string;
  display_name: string;
}

export interface DocumentDetailResponse {
  id: string;
  workspace_id: string;
  uploader: DocumentUploaderResponse;
  title: string;
  file_path: string;
  file_size_bytes: number;
  file_type: string;
  chunk_count: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentStatusResponse {
  id: string;
  status: DocumentStatus;
  chunk_count: number | null;
  error_message: string | null;
}

