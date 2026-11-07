const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Postgres rejects malformed uuids with an error; adapters treat them as "not found". */
export const isUuid = (value: string) => UUID.test(value)
