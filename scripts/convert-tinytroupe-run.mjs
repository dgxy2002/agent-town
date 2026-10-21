import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const [, , scenarioArg, runArg, outputArg] = process.argv;

if (!scenarioArg || !runArg || !outputArg) {
  console.error(
    'Usage: node scripts/convert-tinytroupe-run.mjs <scenario-folder> <run.json> <output.json>',
  );
  process.exit(1);
}

const scenarioDir = resolve(scenarioArg);
const runPath = resolve(runArg);
const outputPath = resolve(outputArg);
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const slug = (value) => value
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const titleCase = (value) => value
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const raw = await readJson(runPath);
if (!raw.run || !Array.isArray(raw.events)) {
  throw new Error(`${basename(runPath)} is not a supported TinyTroupe run export`);
}

const personaDir = join(scenarioDir, 'personas');
const personaFiles = (await readdir(personaDir)).filter((name) => name.endsWith('.json'));
const personas = await Promise.all(
  personaFiles.map(async (name) => (await readJson(join(personaDir, name))).persona),
);
const personaByName = new Map(personas.map((persona) => [persona.name, persona]));
const participantKeys = raw.run.participant_keys ?? [];
const participantNames = raw.run.participant_names ?? [];
const idByName = new Map(participantNames.map((name) => [name, slug(name)]));

const participants = participantNames.map((name, index) => {
  const persona = personaByName.get(name) ?? {};
  const occupation = persona.occupation;
  return {
    id: idByName.get(name),
    name,
    role: typeof occupation === 'object' && occupation?.title
      ? occupation.title
      : titleCase(participantKeys[index] ?? 'participant'),
    scenarioRole: titleCase(participantKeys[index] ?? 'participant'),
    goal: persona.scenario_goal ?? '',
    style: persona.style ?? '',
    conflictStyle: persona.conflict_style ?? '',
  };
});

const events = raw.events
  .filter((event) => idByName.has(event.agent) && ['THINK', 'TALK', 'DONE'].includes(event.type))
  .map((event, index) => ({
    id: `event-${index + 1}`,
    agentId: idByName.get(event.agent),
    agentName: event.agent,
    kind: event.type.toLowerCase(),
    message: event.content,
    target: event.target?.trim() || null,
    round: event.round,
    turn: event.turn,
  }));

const replay = {
  version: 1,
  format: 'agent-town-replay',
  title: `${titleCase(raw.run.scenario)} — ${raw.run.run_id}`,
  description: raw.run.event?.summary ?? 'TinyTroupe multi-agent simulation replay',
  source: {
    format: 'tinytroupe',
    scenario: raw.run.scenario,
    runId: raw.run.run_id,
    model: raw.run.model,
    judgeModel: raw.run.judge_model,
    startedAt: raw.run.started_at,
    finishedAt: raw.run.finished_at,
  },
  participants,
  events,
  result: {
    status: raw.run.status,
    outcome: raw.run.outcome,
    resolved: raw.run.resolution_achieved,
    resolutionRound: raw.run.resolution_round,
    completedRounds: raw.run.completed_rounds,
    confidence: raw.run.confidence,
    conflictEmerged: raw.run.conflict_emerged,
    cookGoalAddressed: raw.run.cook_goal_addressed,
    sensitiveHousemateGoalAddressed: raw.run.sensitive_housemate_goal_addressed,
    ventilationProtocolAgreed: raw.run.ventilation_protocol_agreed,
    dedicatedCookwareAgreed: raw.run.dedicated_cookware_agreed,
    immediateCleanupAgreed: raw.run.immediate_cleanup_agreed,
    offPeakCookingAgreed: raw.run.off_peak_cooking_agreed,
    landlordInterventionRequested: raw.run.landlord_intervention_requested,
  },
  metrics: {
    calls: raw.run.total_resources?.calls ?? null,
    totalTokens: raw.run.total_resources?.total_tokens ?? null,
    costUsd: raw.run.total_resources?.cost_usd ?? null,
    wallTimeMs: raw.run.wall_time_ms ?? null,
  },
};

await writeFile(outputPath, `${JSON.stringify(replay, null, 2)}\n`, 'utf8');
console.log(`Wrote ${events.length} events for ${participants.length} participants to ${outputPath}`);
