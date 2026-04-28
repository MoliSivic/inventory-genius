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
  const { state, setShopContact, setShopName, reset } = useStore();
  const [name, setName] = useState(state.shopName);
  const [email, setEmail] = useState(state.shopEmail ?? "");
  const [telegram, setTelegram] = useState(state.shopTelegram ?? "");
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
          title="Customer Contact"
          description="This contact information appears in the customer ordering app."
        >
          <div className="max-w-md space-y-3">
            <div>
              <Label>Seller Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seller@example.com"
              />
            </div>
            <div>
              <Label>Seller Telegram</Label>
              <Input
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username or https://t.me/username"
              />
            </div>
            <Button
              onClick={() => {
                const result = setShopContact({ email, telegram });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Customer contact saved");
              }}
            >
              Save Contact
            </Button>
          </div>
        </PageSection>
      </div>
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
