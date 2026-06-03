"use client";

import { useState, useTransition } from "react";
import { toggleAttendance } from "@/app/actions";

export default function AttendanceButton({
  eventId,
  checkedIn,
}: {
  eventId: string;
  checkedIn: boolean;
}) {
  const [on, setOn] = useState(checkedIn);
  const [pending, start] = useTransition();

  function toggle() {
    setOn(!on);
    start(() => toggleAttendance(eventId));
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`btn w-full py-4 ${on ? "btn-primary" : "btn-ghost"}`}
    >
      {on ? "✅ 출석 완료 (탭하여 취소)" : "👋 출석 체크하기"}
    </button>
  );
}
