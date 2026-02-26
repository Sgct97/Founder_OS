/**
 * Documents API service — wraps all knowledge base document endpoints.
 */

import { API_BASE_URL } from "@/constants/api";
import { apiDelete, apiGet, getAccessToken } from "@/services/api";
import type {
  DocumentDetailResponse,
  DocumentResponse,
  DocumentStatusResponse,
} from "@/types/documents";

/** Fetch all documents for the workspace, newest first. */
export async function listDocuments(): Promise<DocumentResponse[]> {
  return apiGet<DocumentResponse[]>("/api/v1/documents");
}

/** Fetch detailed info for a single document. */
export async function getDocument(
  documentId: string
): Promise<DocumentDetailResponse> {
  return apiGet<DocumentDetailResponse>(`/api/v1/documents/${documentId}`);
}

/** Check the processing status of a document (lightweight endpoint). */
export async function getDocumentStatus(
  documentId: string
): Promise<DocumentStatusResponse> {
  return apiGet<DocumentStatusResponse>(
    `/api/v1/documents/${documentId}/status`
  );
}

/** Delete a document and its chunks. */
export async function deleteDocument(documentId: string): Promise<void> {
  return apiDelete(`/api/v1/documents/${documentId}`);
}

/**
 * Upload a document file via multipart form.
 *
 * Uses a raw fetch instead of the apiPost helper because
 * we need to send FormData (not JSON).
 */
export async function uploadDocument(
  file: { uri: string; name: string; mimeType: string }
): Promise<DocumentResponse> {
  const token = await getAccessToken();

  const formData = new FormData();
  formData.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);

  const response = await fetch(`${API_BASE_URL}/api/v1/documents`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    let detail = `Upload failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body.detail) {
        detail =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
      // non-JSON response
    }
    throw new Error(detail);
  }

  return response.json();
}

