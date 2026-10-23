"use client";
import { MessagesPanel } from "@/components/messages/MessagesPanel";

export default function EmployeeMessagesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Messages</h1>
      <MessagesPanel />
    </div>
  );
}
