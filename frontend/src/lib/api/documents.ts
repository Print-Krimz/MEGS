export const documentApi = {
  downloadDocument: async (id: number): Promise<Blob> => {
    const token = localStorage.getItem('megs_access_token') || '';
    const response = await fetch(`/api/documents/${id}/download`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.statusText}`);
    }
    return response.blob();
  },
};
