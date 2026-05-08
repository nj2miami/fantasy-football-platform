import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function Field({ label, children, description, className = "" }) {
  return (
    <div className={className}>
      <Label className="text-sm font-black uppercase mb-2 block">{label}</Label>
      {children}
      {description && <p className="text-xs font-bold text-gray-600 mt-2">{description}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, disabled, options, description, className = "" }) {
  const selectedOption = options.find((option) => option.value === value);
  const helperText = description || selectedOption?.description;
  return (
    <Field label={label} description={helperText} className={className}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="neo-border font-bold bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="py-1">
                <div className="font-bold">{option.label}</div>
                {option.description && <div className="text-xs text-gray-500">{option.description}</div>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function NumberField({ label, value, onChange, disabled, min, max, step, description, className = "" }) {
  return (
    <Field label={label} description={description} className={className}>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="neo-border font-bold bg-white disabled:bg-gray-100"
      />
    </Field>
  );
}

export function LeaguePlayFields({ value, onChange, disabled = false, compactLabels = false, showDescriptions = false, showPlayoffDetails = false, fields = null, plain = false }) {
  const update = (patch) => onChange({ ...value, ...patch });
  const visible = new Set(fields || ["draft_mode", "player_retention_mode", "schedule_type", "ranking_system", "advancement_mode", "playoff_mode"]);
  const fieldClass = (className) => plain ? "" : className;
  return (
    <>
      {visible.has("draft_mode") && <SelectField
        label="Draft Cadence"
        value={value.draft_mode}
        onChange={(draftMode) => update({
          draft_mode: draftMode,
          mode: draftMode === "weekly_redraft" ? "weekly_redraft" : "traditional",
          player_retention_mode: draftMode === "weekly_redraft" ? "retained" : value.player_retention_mode,
          player_retention_limit: draftMode === "weekly_redraft" ? null : Number(value.player_retention_limit || 2),
        })}
        disabled={disabled}
        options={[
          {
            value: "season_snake",
            label: compactLabels ? "Season Snake" : "Season Snake Draft",
            description: "Managers draft one roster for the season.",
          },
          {
            value: "weekly_redraft",
            label: "Weekly Redraft",
            description: "Managers draft again each week from eligible players.",
          },
        ]}
        description={showDescriptions ? (
          value.draft_mode === "season_snake"
            ? "Draft once, then set weekly lineups against hidden randomized historical outcomes."
            : "Re-draft every week from the full player pool."
        ) : null}
        className={fieldClass("neo-border p-4 bg-[#FFF1E8]")}
      />}
      {visible.has("player_retention_mode") && <SelectField
        label={compactLabels ? "Retention" : "Player Retention"}
        value={value.player_retention_mode}
        onChange={(playerRetentionMode) => update({ player_retention_mode: playerRetentionMode })}
        disabled={disabled || value.draft_mode === "weekly_redraft"}
        options={[
          {
            value: "retained",
            label: compactLabels ? "Retained" : "Retained Rosters",
            description: "Once drafted, players remain unless manually dropped.",
          },
          {
            value: "limited_use",
            label: "Limited Use",
            description: "Players return to free agency after a configured number of starts.",
          },
        ]}
        description={showDescriptions ? (
          value.draft_mode === "weekly_redraft"
            ? "Weekly redraft leagues reset the available player pool every week."
            : "Limited-use season leagues release a player after the configured number of starts by one team."
        ) : null}
        className={fieldClass("neo-border p-4 bg-white")}
      />}
      {visible.has("player_retention_mode") && value.draft_mode !== "weekly_redraft" && value.player_retention_mode === "limited_use" && (
        <NumberField
          label="Use Limit"
          value={Number(value.player_retention_limit || 2)}
          min="1"
          step="1"
          disabled={disabled}
          onChange={(playerRetentionLimit) => update({ player_retention_limit: Math.max(1, Number(playerRetentionLimit || 1)) })}
          description="Number of starts a player can make for one team before automatic release."
          className={fieldClass("neo-border p-4 bg-[#FFF7D6]")}
        />
      )}
      {visible.has("schedule_type") && <SelectField
        label="Schedule"
        value={value.schedule_type}
        onChange={(scheduleType) => update({ schedule_type: scheduleType })}
        disabled={disabled}
        options={[
          {
            value: "head_to_head",
            label: "Head to Head",
            description: "Teams are paired into weekly matchups.",
          },
          {
            value: "league_wide",
            label: "League Wide",
            description: "Every team competes against the full league each period.",
          },
        ]}
        description={showDescriptions ? "Controls how weekly games are matched." : null}
        className={fieldClass("neo-border p-4 bg-white")}
      />}
      {visible.has("ranking_system") && <SelectField
        label={compactLabels ? "Ranking" : "Standings Format"}
        value={value.ranking_system}
        onChange={(rankingSystem) => update({ ranking_system: rankingSystem })}
        disabled={disabled}
        options={[
          {
            value: "standard",
            label: compactLabels ? "Standard" : "Standard Record",
            description: "Standings are based on wins, losses, and ties.",
          },
          {
            value: "offl",
            label: compactLabels ? "H2H + Points" : "H2H + League Points",
            description: "Keeps head-to-head records and adds weekly league points by total score rank.",
          },
        ]}
        description={showDescriptions ? "H2H + League Points uses record first, then weekly league points as the standings tiebreaker." : null}
        className={fieldClass("neo-border p-4 bg-[#EFFBFF]")}
      />}
      {visible.has("advancement_mode") && <SelectField
        label="Advancement"
        value={value.advancement_mode}
        onChange={(advancementMode) => update({ advancement_mode: advancementMode })}
        options={[
          {
            value: "manual",
            label: "Manual",
            description: "Commissioner advances weeks and reveals results.",
          },
          {
            value: "automatic",
            label: "Automatic",
            description: "League automation advances periods when available.",
          },
        ]}
        description={showDescriptions ? "Controls who moves the league from one period to the next." : null}
        className={fieldClass("neo-border p-4 bg-white")}
      />}
      {visible.has("playoff_mode") && <SelectField
        label={compactLabels ? "Playoff Mode" : "Playoffs"}
        value={value.playoff_mode}
        onChange={(playoffMode) => update({ playoff_mode: playoffMode })}
        disabled={disabled}
        options={[
          {
            value: "roster_only",
            label: "Roster Only",
            description: "Playoffs use the rosters already drafted.",
          },
          {
            value: "redraft",
            label: compactLabels ? "Redraft" : "Playoff Redraft",
            description: "Playoff teams draft a fresh playoff roster.",
          },
        ]}
        description={showDescriptions ? "Controls how playoff rosters are built." : null}
        className={fieldClass("neo-border p-4 bg-white")}
      />}
      {showPlayoffDetails && (
        <>
          <NumberField
            label="Playoff Start Week"
            value={value.playoff_start_week}
            min="2"
            disabled={disabled}
            onChange={(playoffStartWeek) => update({ playoff_start_week: playoffStartWeek || 9 })}
          />
          <NumberField
            label="Playoff Teams"
            value={value.playoff_team_count}
            min="2"
            disabled={disabled}
            onChange={(playoffTeamCount) => update({ playoff_team_count: playoffTeamCount || 4 })}
          />
        </>
      )}
    </>
  );
}

export function ScheduleConfigFields({ value, onChange, disabled = false, boxed = false }) {
  const update = (patch) => onChange({ ...value, ...patch });
  const className = boxed ? "neo-border p-4 bg-white" : "";
  return (
    <>
      <SelectField
        label="Schedule Pattern"
        value={value.type}
        onChange={(type) => update({ type })}
        disabled={disabled}
        options={[
          {
            value: "one_day",
            label: "One Day",
            description: "All scheduled games for a period share one date.",
          },
          {
            value: "interval",
            label: "Every X Days",
            description: "Each period is spaced by the selected number of days.",
          },
          {
            value: "preset",
            label: "Preset Dates",
            description: "Use fixed dates supplied by the league schedule.",
          },
        ]}
        className={className}
      />
      <Field label="Start Date" className={className}>
        <Input
          type="date"
          value={value.start_date || ""}
          disabled={disabled}
          onChange={(event) => update({ start_date: event.target.value })}
          className="neo-border font-bold bg-white disabled:bg-gray-100"
        />
        <p className="text-xs font-bold text-gray-600 mt-2">First scheduled date used when generating the season calendar.</p>
      </Field>
      <NumberField
        label="Games / Period"
        min="1"
        value={value.games_per_period || 1}
        disabled={disabled}
        onChange={(gamesPerPeriod) => update({ games_per_period: gamesPerPeriod || 1 })}
        description="Number of matchups generated inside each schedule period."
        className={className}
      />
      <NumberField
        label="Period Days"
        min="1"
        value={value.period_days || 7}
        disabled={disabled}
        onChange={(periodDays) => update({ period_days: periodDays || 7 })}
        description="Days between generated schedule periods when using an interval pattern."
        className={className}
      />
    </>
  );
}

export function DraftConfigFields({ draftConfig, onDraftConfigChange, sourceSeasonYear, onSourceSeasonYearChange, sourceSeasonYears = [], teamTierCap, onTeamTierCapChange, disabled = false }) {
  const updateDraft = (patch) => onDraftConfigChange({ ...draftConfig, ...patch });
  return (
    <>
      <SelectField
        label="Draft Type"
        value={draftConfig.type}
        onChange={(type) => updateDraft({ type })}
        disabled={disabled}
        options={[
          {
            value: "snake",
            label: "Snake",
            description: "Draft order reverses each round.",
          },
          {
            value: "linear",
            label: "Linear",
            description: "Draft order stays the same every round.",
          },
        ]}
      />
      <NumberField label="Rounds" min="1" value={draftConfig.rounds} disabled={disabled} onChange={(rounds) => updateDraft({ rounds: rounds || 1 })} description="Total draft rounds before rosters are finalized." />
      <NumberField label="Timer Seconds" min="10" value={draftConfig.timer_seconds} disabled={disabled} onChange={(timerSeconds) => updateDraft({ timer_seconds: timerSeconds || 60 })} description="Seconds each manager has to make a pick." />
      {sourceSeasonYears.length ? (
        <SelectField
          label="Source Year"
          value={String(sourceSeasonYear)}
          onChange={(year) => onSourceSeasonYearChange(Number(year))}
          disabled={disabled}
          options={sourceSeasonYears.map((year) => ({ value: String(year), label: String(year) }))}
          description="Completed NFL season used as the hidden source pool."
        />
      ) : (
        <NumberField label="Source Year" value={sourceSeasonYear} disabled={disabled} onChange={(year) => onSourceSeasonYearChange(year || sourceSeasonYear)} description="Completed NFL season used as the hidden source pool." />
      )}
      <NumberField label="Team Tier Cap" min="0" value={teamTierCap} disabled={disabled} onChange={(cap) => onTeamTierCapChange(cap || 0)} description="Maximum combined roster tier value. Use 0 for no cap." />
    </>
  );
}
