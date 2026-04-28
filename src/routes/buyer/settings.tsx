import { createFileRoute } from "@tanstack/react-router";
import { Mail, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getTelegramUrl } from "@/lib/telegram";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/buyer/settings")({
  component: BuyerSettingsPage,
});

function BuyerSettingsPage() {
  const { state, currentBuyer, updateBuyerProfile } = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [market, setMarket] = useState("");
  const [location, setLocation] = useState("");
  const sellerTelegramUrl = getTelegramUrl(state.shopTelegram);

  useEffect(() => {
    setName(currentBuyer?.name ?? "");
    setPhone(currentBuyer?.phone ?? "");
    setTelegram(currentBuyer?.telegram ?? "");
    setMarket(currentBuyer?.market ?? "");
    setLocation(currentBuyer?.location ?? "");
  }, [currentBuyer]);

  const saveProfile = () => {
    const result = updateBuyerProfile({
      name,
      phone,
      telegram,
      market,
      location,
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Settings saved");
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
      <div className="mb-3 sm:mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose your market before sending an order.
        </p>
      </div>

      <div className="space-y-4">
        <section className="rounded-md border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="mb-4">
            <h2 className="font-semibold">Customer Profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your order will be grouped by this market for delivery.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="buyer-name">Name</Label>
              <Input
                id="buyer-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </div>

            <div>
              <Label htmlFor="buyer-phone">Phone</Label>
              <Input
                id="buyer-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone number"
              />
            </div>

            <div>
              <Label htmlFor="buyer-telegram">Telegram</Label>
              <Input
                id="buyer-telegram"
                value={telegram}
                onChange={(event) => setTelegram(event.target.value)}
                placeholder="@username or https://t.me/username"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This helps the seller contact you about orders and receipts.
              </p>
            </div>

            <div>
              <Label>Market</Label>
              <Select value={market} onValueChange={setMarket}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose your market" />
                </SelectTrigger>
                <SelectContent>
                  {state.markets.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.markets.length === 0 && (
                <p className="mt-2 text-xs text-destructive">
                  The seller has not added market locations yet.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="buyer-location">Delivery Detail</Label>
              <Textarea
                id="buyer-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                rows={3}
                placeholder="Stall number, nearby gate, village, or delivery note"
              />
            </div>

            <Button className="w-full sm:w-auto" onClick={saveProfile}>
              Save Settings
            </Button>
          </div>
        </section>

        <section className="rounded-md border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="mb-4">
            <h2 className="font-semibold">Seller Contact</h2>
            <p className="mt-1 text-sm text-muted-foreground">{state.shopName}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {state.shopEmail && (
              <Button variant="outline" asChild>
                <a href={`mailto:${state.shopEmail}`}>
                  <Mail className="h-4 w-4" />
                  Email Seller
                </a>
              </Button>
            )}
            {sellerTelegramUrl && (
              <Button variant="outline" asChild>
                <a href={sellerTelegramUrl} target="_blank" rel="noreferrer">
                  <Send className="h-4 w-4" />
                  Telegram Seller
                </a>
              </Button>
            )}
            {!state.shopEmail && !sellerTelegramUrl && (
              <p className="text-sm text-muted-foreground">
                Seller contact has not been added yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
