"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function OpsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <Card className="mx-auto max-w-md gap-3 p-6 text-center">
        <ShieldAlert className="mx-auto size-7 text-danger" />
        <h2 className="font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          We hit a snag loading this page. Your data is safe — try again.
        </p>
        <Button onClick={reset} className="mx-auto">Try again</Button>
      </Card>
    </div>
  );
}
