/**
 * React Query hooks for documents / knowledge base.
 *
 * Provides data fetching, mutations, cache invalidation,
 * and polling for document processing status.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as documentsService from "@/services/documents";
import type { DocumentResponse, DocumentStatusResponse } from "@/types/documents";

const DOCUMENTS_KEY = ["documents"] as const;
const REFETCH_INTERVAL_MS = 5000;

/** Fetch all documents for the workspace. Polls every 5 seconds. */
export function useDocuments() {
  return useQuery<DocumentResponse[]>({
    queryKey: DOCUMENTS_KEY,
    queryFn: documentsService.listDocuments,
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

/** Fetch a single document's detail. */
export function useDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: [...DOCUMENTS_KEY, documentId],
    queryFn: () => documentsService.getDocument(documentId!),
    enabled: !!documentId,
  });
}

/**
 * Poll a document's processing status.
 * Automatically stops polling once the document reaches a terminal state.
 */
export function useDocumentStatus(documentId: string | undefined) {
  return useQuery<DocumentStatusResponse>({
    queryKey: [...DOCUMENTS_KEY, documentId, "status"],
    queryFn: () => documentsService.getDocumentStatus(documentId!),
    enabled: !!documentId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === "ready" || data.status === "failed")) {
        return false; // Stop polling on terminal states.
      }
      return 2000; // Poll every 2s while processing.
    },
  });
}

/** Upload a document. Invalidates the documents cache on success. */
export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: { uri: string; name: string; mimeType: string }) =>
      documentsService.uploadDocument(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY });
    },
  });
}

/** Delete a document. Invalidates the documents cache on success. */
export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      documentsService.deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY });
    },
  });
}

