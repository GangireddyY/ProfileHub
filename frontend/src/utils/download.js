import { api } from '@/api/http';

/** Downloads an API file (CSV, JSON) with this tab's session and saves it under the server's filename. */
export async function downloadFromApi(path, params = {}, fallbackName = 'export.csv') {
  const res = await api.get(path, { params, responseType: 'blob', timeout: 120000 });
  const disposition = res.headers['content-disposition'] || '';
  const name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || fallbackName;
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
