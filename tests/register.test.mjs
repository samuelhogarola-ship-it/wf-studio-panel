import test from "node:test";
import assert from "node:assert/strict";

import { registerPendingClient } from "../src/lib/auth/register.mjs";

test("registerPendingClient deletes auth user when client insert fails", async () => {
  const deletedUsers = [];

  const result = await registerPendingClient({
    name: "Cliente Demo",
    email: "Demo@Example.com",
    password: "secret123",
    signUp: async () => ({
      userId: "user-123",
      error: null,
    }),
    insertClient: async () => ({
      error: { message: "duplicate key value violates lower(email)" },
    }),
    deleteUser: async (userId) => {
      deletedUsers.push(userId);
    },
  });

  assert.deepEqual(deletedUsers, ["user-123"]);
  assert.equal(result.error, "Ya existe un cliente con ese email.");
});

test("registerPendingClient normalizes email and returns success on valid registration", async () => {
  const insertedClients = [];

  const result = await registerPendingClient({
    name: "Cliente Demo",
    email: "Demo@Example.com",
    password: "secret123",
    signUp: async ({ email, password }) => ({
      userId:
        email === "demo@example.com" && password === "secret123"
          ? "user-123"
          : null,
      error: null,
    }),
    insertClient: async (client) => {
      insertedClients.push(client);
      return { error: null };
    },
    deleteUser: async () => {},
  });

  assert.equal(
    result.success,
    "Solicitud enviada. El equipo revisará tu acceso y te avisaremos.",
  );
  assert.deepEqual(insertedClients, [
    {
      id: "user-123",
      name: "Cliente Demo",
      email: "demo@example.com",
      project: "wf-studio",
      status: "pending",
    },
  ]);
});
