export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]!);
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (typeof value === "string" && /^\s*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      keys.map(cell).join(","),
      ...rows.map((row) => keys.map((key) => cell(row[key])).join(",")),
    ].join("\r\n")
  );
}

export async function changeAccountAccess(
  client: {
    auth: {
      admin: {
        updateUserById: (
          id: string,
          attributes: { ban_duration: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  },
  actorId: string,
  targetId: string,
  suspended: boolean,
) {
  if (actorId === targetId) throw new Error("You cannot change your own sign-in access");
  const { error } = await client.auth.admin.updateUserById(targetId, {
    ban_duration: suspended ? "876000h" : "none",
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}
