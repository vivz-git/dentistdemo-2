"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppointmentsView } from "@/components/appointments/appointments-view";

/** `?appt=<id>` deep-links a booked appointment straight into the reschedule form. */
function Route() {
  const appt = useSearchParams().get("appt") ?? undefined;
  return <AppointmentsView key={appt ?? "none"} initialAppt={appt} />;
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<div className="p-6" aria-busy="true" />}>
      <Route />
    </Suspense>
  );
}
