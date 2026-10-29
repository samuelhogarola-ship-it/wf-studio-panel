function isDuplicateAuthError(message) {
  return typeof message === 'string' && message.toLowerCase().includes('already registered')
}

function isDuplicateClientError(message) {
  if (typeof message !== 'string') return false
  const normalized = message.toLowerCase()
  return normalized.includes('duplicate key value') || normalized.includes('clients_project_email_lower_unique_idx')
}

export async function createClientWithPassword({
  name,
  company,
  email,
  phone,
  status = 'active',
  project,
  generatePassword,
  createAuthUser,
  insertClient,
  deleteAuthUser,
}) {
  const normalizedEmail = email.trim().toLowerCase()
  const password = generatePassword()
  const { userId, error: authError } = await createAuthUser({ email: normalizedEmail, password })

  if (authError || !userId) {
    return {
      error: isDuplicateAuthError(authError?.message)
        ? 'Ya existe una cuenta con ese email.'
        : 'No se pudo crear el acceso del cliente.',
    }
  }

  const { error: clientError } = await insertClient({
    id: userId,
    name,
    company: company || null,
    email: normalizedEmail,
    phone: phone || null,
    status,
    project,
  })

  if (clientError) {
    try {
      await deleteAuthUser(userId)
    } catch {
      // Preserve the client creation error; cleanup can be retried operationally.
    }

    return {
      error: isDuplicateClientError(clientError.message)
        ? 'Ya existe un cliente con ese email en este espacio.'
        : 'No se pudo crear el cliente.',
    }
  }

  return { success: `Cliente ${name} creado correctamente.`, generatedPassword: password }
}
