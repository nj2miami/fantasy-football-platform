import { BadgeCheck, ClipboardList, HeartPulse, Lock } from "lucide-react";
import { DEFAULT_ROSTER_RULES } from "@/api/appClient";

const ROSTER_LABELS = {
  QB: "Quarterback",
  K: "Kicker",
  DEF: "Defense",
  OFF: "Offense",
  FLEX: "Flex",
};

const ROSTER_ORDER = ["QB", "K", "DEF", "OFF", "FLEX"];

function rosterGroupsFromRules(rules, key) {
  const values = { ...(DEFAULT_ROSTER_RULES[key] || {}), ...((rules?.[key] && typeof rules[key] === "object") ? rules[key] : {}) };
  return ROSTER_ORDER
    .filter((position) => Number(values[position] || 0) > 0)
    .map((position) => ({
      label: ROSTER_LABELS[position] || position,
      value: `${Number(values[position] || 0)} ${position}`,
    }));
}

function RuleCard({ label, value }) {
  return (
    <div className="neo-border p-4 bg-white">
      <p className="text-xs font-black uppercase text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-black text-black">{value}</p>
    </div>
  );
}

export default function LeagueRosterSettings() {
  const rosterRules = DEFAULT_ROSTER_RULES;
  const draftGroups = rosterGroupsFromRules(rosterRules, "draft_groups");
  const starterSlots = rosterGroupsFromRules(rosterRules, "starters");
  const benchCount = Number(rosterRules.bench || 0);
  const benchScoring = Math.round(Number(rosterRules.bench_scoring_multiplier || 0) * 100);
  const treatmentScoring = Math.round(Number(rosterRules.treatment_scoring_multiplier || 0) * 100);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-2xl font-black uppercase">Roster Settings</h3>
          <Lock className="w-5 h-5 text-gray-500" />
        </div>
        <p className="text-sm font-bold text-gray-600">
          Roster rules are fixed for this version and are shown here for commissioner reference.
        </p>
      </div>

      <div className="neo-border bg-[#FFF1E8] p-4 flex gap-3">
        <ClipboardList className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-black uppercase">Draft Roster</p>
          <p className="text-sm font-bold text-gray-700">
            Each team drafts {rosterRules.total_drafted} total players: 2 QB, 1 K, 2 DEF, 2 OFF, and 3 Flex players from Offense or Defense. Teams may roster no more than 4 Offense or 4 Defense players.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {draftGroups.map((group) => (
          <RuleCard key={group.label} label={group.label} value={group.value} />
        ))}
      </div>

      <div className="neo-border bg-[#EFFBFF] p-4 flex gap-3">
        <BadgeCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-black uppercase">Weekly Lineup</p>
          <p className="text-sm font-bold text-gray-700">
            Each week, managers choose 5 starters. The remaining 5 players are placed on the bench.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {starterSlots.map((slot) => (
          <RuleCard key={slot.label} label={slot.label} value={slot.value} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RuleCard label="Bench" value={`${benchCount} Players`} />
        <RuleCard label="Bench Scoring" value={`${benchScoring}%`} />
        <RuleCard label="Treatment Scoring" value={`${treatmentScoring}%`} />
      </div>

      <div className="neo-border bg-gray-50 p-4 flex gap-3">
        <HeartPulse className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-black uppercase">Durability</p>
          <p className="text-sm font-bold text-gray-700">
            Starters lose 1 durability after use. Bench players can be treated to restore 1 durability, but treated players only contribute 25% of their weekly value.
          </p>
        </div>
      </div>
    </div>
  );
}
