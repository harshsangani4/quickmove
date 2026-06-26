import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/status-chip";
import { EmptyState } from "@/components/empty-state";
import { Star, TrendingUp, AlertTriangle, Home, Truck, ShieldAlert } from "lucide-react";

/** Composite vendor score (build doc §5.5): rewards on-time + rating, penalises issues. */
export function vendorScore(v: { on_time_pct: number; issue_rate: number; rating: number }) {
  return Math.round(v.on_time_pct * 0.5 + v.rating * 20 * 0.4 - v.issue_rate * 1.2);
}

export default async function VendorsPage() {
  await requireUser();
  const supabase = await createClient();

  const { data: cities } = await supabase.from("cities").select("id, name").order("name");
  const { data: vendors } = await supabase.from("vendors").select("*");
  const { data: apartments } = await supabase.from("apartments").select("vendor_id");

  const movesByVendor = new Map<string, number>();
  for (const a of apartments ?? []) {
    if (a.vendor_id) movesByVendor.set(a.vendor_id, (movesByVendor.get(a.vendor_id) ?? 0) + 1);
  }

  const byCity = new Map<string, any[]>();
  for (const v of vendors ?? []) {
    if (!byCity.has(v.city_id)) byCity.set(v.city_id, []);
    byCity.get(v.city_id)!.push(v);
  }

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Property partners & movers, scored by performance. The top active vendor per type is recommended."
      />
      <div className="space-y-8 p-6">
        {(cities ?? []).map((city) => {
          const list = byCity.get(city.id) ?? [];
          return (
            <section key={city.id}>
              <h2 className="mb-3 text-sm font-semibold">{city.name}</h2>
              <div className="grid gap-6 lg:grid-cols-2">
                {(["property", "movers"] as const).map((type) => {
                  const ofType = list
                    .filter((v) => v.type === type)
                    .map((v) => ({ ...v, score: vendorScore(v) }))
                    .sort((a, b) => b.score - a.score);
                  const activeOfType = ofType.filter((v) => v.active);
                  const recommendedId = activeOfType[0]?.id;

                  return (
                    <div key={type}>
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {type === "property" ? <Home className="size-3.5" /> : <Truck className="size-3.5" />}
                        {type === "property" ? "Property partners" : "Packers & movers"}
                      </div>

                      {activeOfType.length === 0 ? (
                        <Card className="flex-row items-center gap-2 border-warning/40 bg-warning-muted/40 p-4">
                          <ShieldAlert className="size-4 text-warning-foreground" />
                          <span className="text-sm">No active vendor available — escalate.</span>
                        </Card>
                      ) : (
                        <div className="space-y-2">
                          {ofType.map((v) => (
                            <Card key={v.id} className={`gap-2 p-4 ${!v.active ? "opacity-60" : ""}`}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{v.name}</span>
                                  {v.id === recommendedId && (
                                    <StatusChip tone="brand" dot={false}>Recommended</StatusChip>
                                  )}
                                  {!v.active && <Badge variant="outline" className="text-[10px]">inactive</Badge>}
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-semibold tabular-nums text-brand">{v.score}</div>
                                  <div className="text-[10px] text-muted-foreground">score</div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1"><TrendingUp className="size-3.5 text-success" /> {v.on_time_pct}% on-time</span>
                                <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3.5 text-warning-foreground" /> {v.issue_rate}% issues</span>
                                <span className="inline-flex items-center gap-1"><Star className="size-3.5 text-warning-foreground" /> {v.rating}</span>
                                {type === "property" && (
                                  <span>{movesByVendor.get(v.id) ?? 0} moves handled</span>
                                )}
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {(cities ?? []).length === 0 && <EmptyState title="No cities yet" />}
      </div>
    </>
  );
}
