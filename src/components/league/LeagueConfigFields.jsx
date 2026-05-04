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
  return (
    <Field label={label} description={description} className={className}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="neo-border font-bold bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
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

export function LeaguePlayFields({ value, onChange, disabled = false, compactLabels = false, showDescriptions = false, showPlayoffDetails = false, fields = null }) {
  const update = (patch) => onChange({ ...value, ...patch });
  const visible = new Set(fields || ["draft_mode", "player_retention_mode", "schedule_type", "ranking_system", "advancement_mode", "playoff_mode"]);
  return (
    <>
      {visible.has("draft_mode") && <SelectField
        label="Draft Cadence"
        value={value.draft_mode}
        onChange={(draftMode) => update({
          draft_mode: draftMode,
          mode: draftMode === "weekly_redraft" ? "weekly_redraft" : "traditional",
          player_retention_mode: draftMode === "weekly_redraft" ? "retained" : value.player_retention_mode,
        })}
        disabled={disabled}
        options={[
          { value: "season_snake", label: compactLabels ? "Season Snake" : "Season Snake Draft" },
          { value: "weekly_redraft", label: "Weekly Redraft" },
        ]}
        description={showDescriptions ? (
          value.draft_mode === "season_snake"
            ? "Draft once, then set weekly lineups against hidden randomized historical outcomes."
            : "Re-draft every week, and each manager can use a player only once during the regular season."
        ) : null}
        className="neo-border p-4 bg-[#FFF1E8]"
      />}
      {visible.has("player_retention_mode") && <SelectField
        label={compactLabels ? "Retention" : "Player Retention"}
        value={value.player_retention_mode}
        onChange={(playerRetentionMode) => update({ player_retention_mode: playerRetentionMode })}
        disabled={disabled || value.draft_mode === "weekly_redraft"}
        options={[
          { value: "retained", label: compactLabels ? "Retained" : "Retained Rosters" },
          { value: "two_use_release", label: "Two-Use Release" },
        ]}
        description={showDescriptions ? "Two-use leagues release a player to free agency after his second resolved start." : null}
        className="neo-border p-4 bg-white"
      />}
      {visible.has("schedule_type") && <SelectField
        label="Schedule"
        value={value.schedule_type}
        onChange={(scheduleType) => update({ schedule_type: scheduleType })}
        disabled={disabled}
        options={[
          { value: "head_to_head", label: "Head to Head" },
          { value: "league_wide", label: "League Wide" },
        ]}
        className="neo-border p-4 bg-white"
      />}
      {visible.has("ranking_system") && <SelectField
        label={compactLabels ? "Ranking" : "Standings Format"}
        value={value.ranking_system}
        onChange={(rankingSystem) => update({ ranking_system: rankingSystem })}
        disabled={disabled}
        options={[
          { value: "standard", label: compactLabels ? "Standard" : "Standard Record" },
          { value: "offl", label: compactLabels ? "OFFL" : "OFFL Points" },
        ]}
        description={showDescriptions ? "OFFL adds 4 points per win plus 4/3/2/1 for weekly top scorers." : null}
        className="neo-border p-4 bg-[#EFFBFF]"
      />}
      {visible.has("advancement_mode") && <SelectField
        label="Advancement"
        value={value.advancement_mode}
        onChange={(advancementMode) => update({ advancement_mode: advancementMode })}
        options={[
          { value: "manual", label: "Manual" },
          { value: "automatic", label: "Automatic" },
        ]}
        className="neo-border p-4 bg-white"
      />}
      {visible.has("playoff_mode") && <SelectField
        label={compactLabels ? "Playoff Mode" : "Playoffs"}
        value={value.playoff_mode}
        onChange={(playoffMode) => update({ playoff_mode: playoffMode })}
        disabled={disabled}
        options={[
          { value: "roster_only", label: "Roster Only" },
          { value: "redraft", label: compactLabels ? "Redraft" : "Playoff Redraft" },
        ]}
        className="neo-border p-4 bg-white"
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
          { value: "one_day", label: "One Day" },
          { value: "interval", label: "Every X Days" },
          { value: "preset", label: "Preset Dates" },
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
      </Field>
      <NumberField
        label="Games / Period"
        min="1"
        value={value.games_per_period || 1}
        disabled={disabled}
        onChange={(gamesPerPeriod) => update({ games_per_period: gamesPerPeriod || 1 })}
        className={className}
      />
      <NumberField
        label="Period Days"
        min="1"
        value={value.period_days || 7}
        disabled={disabled}
        onChange={(periodDays) => update({ period_days: periodDays || 7 })}
        className={className}
      />
    </>
  );
}

export function DraftConfigFields({ draftConfig, onDraftConfigChange, sourceSeasonYear, onSourceSeasonYearChange, teamTierCap, onTeamTierCapChange, managerPointsStarting, onManagerPointsStartingChange, disabled = false }) {
  const updateDraft = (patch) => onDraftConfigChange({ ...draftConfig, ...patch });
  return (
    <>
      <SelectField
        label="Draft Type"
        value={draftConfig.type}
        onChange={(type) => updateDraft({ type })}
        disabled={disabled}
        options={[
          { value: "snake", label: "Snake" },
          { value: "linear", label: "Linear" },
        ]}
      />
      <NumberField label="Rounds" min="1" value={draftConfig.rounds} disabled={disabled} onChange={(rounds) => updateDraft({ rounds: rounds || 1 })} />
      <NumberField label="Timer Seconds" min="10" value={draftConfig.timer_seconds} disabled={disabled} onChange={(timerSeconds) => updateDraft({ timer_seconds: timerSeconds || 60 })} />
      <NumberField label="Source Year" value={sourceSeasonYear} disabled={disabled} onChange={(year) => onSourceSeasonYearChange(year || sourceSeasonYear)} />
      <NumberField label="Team Tier Cap" min="0" value={teamTierCap} disabled={disabled} onChange={(cap) => onTeamTierCapChange(cap || 0)} />
      <NumberField label="Manager Points" min="0" value={managerPointsStarting} disabled={disabled} onChange={(points) => onManagerPointsStartingChange(points || 0)} />
    </>
  );
}
