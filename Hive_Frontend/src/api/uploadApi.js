import http from "./http";

export const uploadApi = {
  /**
   * Upload a single file.
   * @param {File} file - The File object from an <input type="file">
   * @param {"students"|"staff"|"documents"} [category="documents"]
   * @returns {{ url: string }} - Public URL to access the file
   */
  async uploadFile(file, category = "documents") {
    const formData = new FormData();
    formData.append("file", file);

    const { data } = await http.post(`/api/upload/${category}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // Backend returns { url } — the static path under /uploads/...
    return data;
  },
};
