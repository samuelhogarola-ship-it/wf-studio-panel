const DUPLICATE_AUTH_FRAGMENT = "already registered";

function isDuplicateClientError(message) {
  if (typeof message !== "string") return false;

  return (
    message.includes("duplicate key value") ||
    message.includes("clients_email_lower_unique_idx") ||
    message.includes("clients_project_email_lower_unique_idx")
  );
}

export async function registerPendingClient({
  name,
  email,
  password,
  signUp,
  insertClient,
  deleteUser,
}) {
  const normalizedEmail = email.toLowerCase();
  const { userId, error: signUpError } = await signUp({
    email: normalizedEmail,
    password,
  });

  if (signUpError) {
    if (signUpError.message.includes(DUPLICATE_AUTH_FRAGMENT)) {
      return { error: "Ya existe una cuenta con ese email." };
    }

    return { error: "No se pudo crear la cuenta. Inténtalo de nuevo." };
  }

  const { error: clientError } = await insertClient({
    id: userId ?? undefined,
    name,
    email: normalizedEmail,
    project: "wf-studio",
    status: "pending",
  });

  if (clientError) {
    if (userId) {
      try {
        await deleteUser(userId);
      } catch {
        // Evita ocultar el error principal de registro si el cleanup falla.
      }
    }

    if (isDuplicateClientError(clientError.message)) {
      return { error: "Ya existe un cliente con ese email." };
    }

    return { error: "No se pudo completar el registro." };
  }

  return {
    success: "Solicitud enviada. El equipo revisará tu acceso y te avisaremos.",
  };
}
