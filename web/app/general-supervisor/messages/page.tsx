"use client";
import { PageHeader } from "@/components/layout/AdminChrome";
import { MessagesPanel } from "@/components/messages/MessagesPanel";

export default function MessagesPage() {
  return (
    <div>
      <PageHeader title="Messages" subtitle="Direct messages. You can reach the people your role covers." />
      <MessagesPanel />
    </div>
  );
}
