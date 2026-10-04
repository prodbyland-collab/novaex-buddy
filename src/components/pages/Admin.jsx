import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as functions from "@/lib/admin.functions";
import { publishGroupNews } from "@/lib/group.functions";
import { useAuth } from "@/lib/auth";
import AdminConsole from "@/components/admin/AdminConsole";

export default function Admin() {
  const { user } = useAuth();
  const overview = useServerFn(functions.adminOverview);
  const auditHistory = useServerFn(functions.adminAuditHistory);
  const setBalance = useServerFn(functions.adminSetBalance);
  const adjustBalance = useServerFn(functions.adminAdjustBalance);
  const setPlan = useServerFn(functions.adminSetPlan);
  const setBoost = useServerFn(functions.adminSetBoost);
  const setAdminRole = useServerFn(functions.adminSetAdminRole);
  const setAccountAccess = useServerFn(functions.adminSetAccountAccess);
  const deleteUser = useServerFn(functions.adminDeleteUser);
  const updateDeposit = useServerFn(functions.adminUpdateDeposit);
  const updateWithdrawal = useServerFn(functions.adminUpdateWithdrawal);
  const rotateCode = useServerFn(functions.adminRotateDailyCode);
  const runPayout = useServerFn(functions.adminRunPayout);
  const publishNews = useServerFn(publishGroupNews);
  const deleteAnnouncement = useServerFn(functions.adminDeleteAnnouncement);
  const services = useMemo(
    () => ({
      overview,
      auditHistory,
      setBalance,
      adjustBalance,
      setPlan,
      setBoost,
      setAdminRole,
      setAccountAccess,
      deleteUser,
      updateDeposit,
      updateWithdrawal,
      rotateCode,
      runPayout,
      publishNews,
      deleteAnnouncement,
    }),
    [
      overview,
      auditHistory,
      setBalance,
      adjustBalance,
      setPlan,
      setBoost,
      setAdminRole,
      setAccountAccess,
      deleteUser,
      updateDeposit,
      updateWithdrawal,
      rotateCode,
      runPayout,
      publishNews,
      deleteAnnouncement,
    ],
  );
  return <AdminConsole services={services} viewerId={user?.id} />;
}
