import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarBlank } from "@phosphor-icons/react";

export function ReleaseSettings({
  releaseType,
  onReleaseTypeChange,
  scheduledDate,
  onScheduledDateChange,
  phasedRelease,
  onPhasedReleaseChange,
  readOnly,
}: {
  releaseType: string;
  onReleaseTypeChange: (value: string) => void;
  scheduledDate: Date | undefined;
  onScheduledDateChange: (date: Date | undefined) => void;
  phasedRelease: boolean;
  onPhasedReleaseChange: (value: boolean) => void;
  readOnly: boolean;
}) {
  return (
    <section className="space-y-6">
      <h3 className="section-title">Release settings</h3>

      <div className="space-y-3">
        <p className="text-sm font-medium">Release method</p>
        <Tabs
          value={releaseType}
          onValueChange={readOnly ? undefined : onReleaseTypeChange}
          className="w-full max-w-md"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="automatically" disabled={readOnly}>
              Automatic
            </TabsTrigger>
            <TabsTrigger value="manually" disabled={readOnly}>
              Manual
            </TabsTrigger>
            <TabsTrigger value="after-date" disabled={readOnly}>
              Scheduled
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-sm text-muted-foreground">
          {releaseType === "automatically" &&
            "Goes live as soon as App Review approves it."}
          {releaseType === "manually" &&
            "Stays on hold after approval \u2013 you decide when to release."}
          {releaseType === "after-date" &&
            "Released on a date you choose, after approval."}
        </p>
        {releaseType === "after-date" && (
          <div className="pt-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={readOnly}
                  className="w-full max-w-xs justify-start gap-2 font-normal"
                >
                  <CalendarBlank size={16} className="text-muted-foreground" />
                  {scheduledDate
                    ? scheduledDate.toLocaleString(undefined, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Pick a release date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={(date) => {
                    if (!date) return;
                    // Preserve existing time or default to noon local
                    const prev = scheduledDate;
                    date.setHours(prev?.getHours() ?? 12, prev?.getMinutes() ?? 0, 0, 0);
                    onScheduledDateChange(date);
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
                <div className="border-t px-3 py-2">
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <Input
                    type="time"
                    value={scheduledDate
                      ? `${String(scheduledDate.getHours()).padStart(2, "0")}:${String(scheduledDate.getMinutes()).padStart(2, "0")}`
                      : "12:00"}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      const d = scheduledDate ? new Date(scheduledDate) : new Date();
                      d.setHours(h, m, 0, 0);
                      onScheduledDateChange(d);
                    }}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Phased rollout</p>
        <p className="text-sm text-muted-foreground">
          Gradually roll out to users over 7 days. Only affects automatic
          updates – manual downloads get the new version immediately.
        </p>
        <div className="flex items-center gap-3">
          <Switch
            checked={phasedRelease}
            onCheckedChange={onPhasedReleaseChange}
            disabled={readOnly}
          />
          <Label className="text-sm">Enable 7-day phased rollout</Label>
        </div>
      </div>
    </section>
  );
}
