export function canReadResource(identity: {role: string; clientId?: string} | null, clientId: string): boolean;
export function validateImage(bytes: Uint8Array, type: string): boolean;
