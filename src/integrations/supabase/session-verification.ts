type VerificationResult = {
  data: boolean | null;
  error: { code?: string; message: string } | null;
};

export const ACCOUNTING_MIGRATION = "20261004120000_secure_accounting.sql";

export function assertVerifiedSession({ data, error }: VerificationResult): void {
  if (error?.code === "PGRST202" || error?.code === "42883") {
    throw new Error("This deployment needs a database update. Contact the site administrator.");
  }
  if (error) {
    throw new Error("Authentication verification is temporarily unavailable. Please try again.");
  }
  if (data !== true) {
    throw new Error("Complete authentication verification before continuing.");
  }
}
