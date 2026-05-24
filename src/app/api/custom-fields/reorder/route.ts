import { ApiError, handleApiError } from "@/lib/api/errors";

// Reordering custom fields is now exclusively managed by the Super Admin.
// This endpoint returns 403 for tenant users.

export async function POST() {
  try {
    throw new ApiError(403, "A reordenação de campos personalizados é gerenciada exclusivamente pelo Super Admin.");
  } catch (error) {
    return handleApiError(error);
  }
}
