import { BadgeCheck, ClipboardList, HeartPulse, Lock } from "lucide-react";

const DRAFT_GROUPS = [
  { label: "Quarterback", value: "2 QB" },
  { label: "Kicker", value: "1 K" },
  { label: "Defense", value: "2 DEF" },
  { label: "Offense", value: "2 OFF" },
  { label: "Flex", value: "3 FLEX" },
];

const STARTER_SLOTS = [
  { label: "Quarterback", value: "1 QB" },
  { label: "Kicker", value: "1 K" },
  { label: "Defense", value: "1 DEF" },
  { label: "Offense", value: "1 OFF" },
  { label: "Flex", value: "1 FLEX" },
];

function RuleCard({ label, value }) {
  return (
    <div className="neo-border p-4 bg-white">
      <p className="text-xs font-black uppercase text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-black text-black">{value}</p>
    </div>
  );
}

export default function LeagueRosterSettings() {
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
            Each team drafts 10 total players: 2 QB, 1 K, 2 DEF, 2 OFF, and 3 Flex players from Offense or Defense.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {DRAFT_GROUPS.map((group) => (
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
        {STARTER_SLOTS.map((slot) => (
          <RuleCard key={slot.label} label={slot.label} value={slot.value} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RuleCard label="Bench" value="5 Players" />
        <RuleCard label="Bench Scoring" value="50%" />
        <RuleCard label="Treatment Scoring" value="25%" />
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
