import { clearCsrfToken } from "../../shared/lib/api";
import { fetchMe, login, logout } from "../../shared/lib/api/auth";

export async function bootstrapSession() {
  try {
    const me = await fetchMe();
    if (me?.role !== "ADMIN") {
      return { state: "unauthorized", user: me || null };
    }
    return { state: "authenticated", user: me };
  } catch (_error) {
    return { state: "anonymous", user: null };
  }
}

export async function loginAdmin(email, password) {
  await login(email, password);
  return bootstrapSession();
}

export async function logoutAdmin() {
  try {
    await logout();
  } finally {
    clearCsrfToken();
  }
}
