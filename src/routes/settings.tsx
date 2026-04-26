import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader, PageSection } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { state, setShopName, reset } = useStore();
  const [name, setName] = useState(state.shopName);
  return (
    <div>
      <PageHeader title="Settings" description="Shop preferences and prototype data." />
      <PageSection title="Shop">
        <div className="max-w-md space-y-3">
          <div>
            <Label>Shop / Seller Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button
            onClick={() => {
              setShopName(name);
              toast.success("Saved");
            }}
          >
            Save
          </Button>
        </div>
      </PageSection>
      <div className="mt-6">
        <PageSection
          title="Reset Data"
          description="Reset all data back to the empty starter state."
        >
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Reset all data?")) {
                reset();
                toast.success("Data reset");
              }
            }}
          >
            Reset Data
          </Button>
        </PageSection>
      </div>
      <div className="mt-6">
        <PageSection title="About">
          <p className="text-sm text-muted-foreground">
            Customer-Based Inventory, Sales, and Estimated Profit Tracking System with localStorage
            persistence. Owner / Admin role.
          </p>
        </PageSection>
      </div>
    </div>
  );
}
