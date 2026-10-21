import type { AgentTown } from '../src/index';
import type { AgentActivity, ActivityEvent } from '../src/types';

const SOCIAL_STAGES = [
  { id: 'backlog', name: 'Context', color: '#95A5A6', buildingStyle: 'office' as const },
  { id: 'todo', name: 'Concerns', color: '#E67E22', buildingStyle: 'workshop' as const },
  { id: 'in_progress', name: 'Proposals', color: '#3498DB', buildingStyle: 'lab' as const },
  { id: 'review', name: 'Open Issues', color: '#9B59B6', buildingStyle: 'warehouse' as const },
  { id: 'done', name: 'Agreements', color: '#27AE60', buildingStyle: 'depot' as const },
];

export type ReplayEventKind = 'think' | 'talk' | 'done';

export interface ReplayParticipant {
  id: string;
  name: string;
  role: string;
  scenarioRole: string;
  goal: string;
  style: string;
  conflictStyle: string;
}

export interface ReplayEvent {
  id: string;
  agentId: string;
  agentName: string;
  kind: ReplayEventKind;
  message: string;
  target: string | null;
  round: number;
  turn: number;
}

export interface ScenarioReplay {
  version: 1;
  format: 'agent-town-replay';
  title: string;
  description: string;
  source: {
    format: string;
    scenario: string;
    runId: string;
    model: string;
    judgeModel: string;
    startedAt: string;
    finishedAt: string;
  };
  participants: ReplayParticipant[];
  events: ReplayEvent[];
  result: {
    status: string;
    outcome: string;
    resolved: boolean;
    resolutionRound: number | null;
    completedRounds: number;
    confidence: number;
    conflictEmerged: boolean;
    cookGoalAddressed: boolean;
    sensitiveHousemateGoalAddressed: boolean;
    ventilationProtocolAgreed: boolean;
    dedicatedCookwareAgreed: boolean;
    immediateCleanupAgreed: boolean;
    offPeakCookingAgreed: boolean;
    landlordInterventionRequested: boolean;
  };
  metrics: {
    calls: number | null;
    totalTokens: number | null;
    costUsd: number | null;
    wallTimeMs: number | null;
  };
}

const EVENT_ACTIVITY: Record<ReplayEventKind, AgentActivity> = {
  think: 'reflecting',
  talk: 'speaking',
  done: 'listening',
};

const EVENT_LOG_TYPE: Record<ReplayEventKind, ActivityEvent['type']> = {
  think: 'status_change',
  talk: 'message',
  done: 'status_change',
};

const EVENT_DELAY: Record<ReplayEventKind, number> = {
  think: 650,
  talk: 1300,
  done: 350,
};

export class ScenarioReplayPlayer {
  readonly town: AgentTown;
  readonly replay: ScenarioReplay;
  cursor = 0;
  speed = 1;
  running = false;
  paused = false;
  onUpdate: (() => void) | null = null;
  onComplete: (() => void) | null = null;

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(town: AgentTown, replay: ScenarioReplay) {
    this.town = town;
    this.replay = replay;
  }

  seed(): void {
    this.clearTimer();
    this.cursor = 0;
    this.running = false;
    this.paused = false;

    this.town.setRoomMode('environment');
    this.town.setStages(SOCIAL_STAGES);
    this.town.setOfficeSize(this.replay.participants.length <= 8 ? 'small' : 'medium');
    this.town.removeAllAgents();
    this.town.clearTasks();
    this.town.clearReviews();
    this.town.clearActivityLog();
    this.town.clearObjectives();
    this.town.clearStories();
    this.town.clearSprints();
    for (const workspace of this.town.getWorkspaces()) {
      this.town.removeWorkspace(workspace.id);
    }

    this.town.addWorkspace({
      id: `replay-${this.replay.source.scenario}`,
      name: this.replay.source.scenario.replace(/[-_]/g, ' '),
      color: '#27AE60',
      agentIds: this.replay.participants.map((participant) => participant.id),
    });
    this.town.addSprint({
      id: `replay-sprint-${this.replay.source.runId}`,
      name: this.replay.source.runId,
      goal: this.replay.description,
      status: this.replay.result.status === 'completed' ? 'completed' : 'active',
    });
    this.town.addObjective({
      id: 'replay-objective',
      title: 'Reach a workable household agreement',
      description: this.replay.description,
      priority: 'critical',
      status: this.replay.result.resolved ? 'completed' : 'active',
      sprintId: `replay-sprint-${this.replay.source.runId}`,
    });
    this.town.addStory({
      id: 'replay-story',
      objectiveId: 'replay-objective',
      title: 'Shared-kitchen event',
      description: this.replay.description,
      priority: 'high',
      status: this.replay.result.resolved ? 'done' : 'in_progress',
      points: this.replay.result.completedRounds,
    });
    this.town.addTask({
      id: 'replay-resolution',
      storyId: 'replay-story',
      title: 'Reach a mutually accepted resolution',
      description: `Evaluation outcome: ${this.replay.result.outcome}`,
      priority: 'critical',
      stage: this.replay.result.resolved ? 'done' : 'review',
    });
    this.town.addTask({
      id: 'replay-ventilation',
      storyId: 'replay-story',
      title: 'Agree on a ventilation protocol',
      description: 'Open the window and use the exhaust fan while cooking.',
      priority: 'high',
      stage: this.replay.result.ventilationProtocolAgreed ? 'done' : 'in_progress',
    });
    this.town.addTask({
      id: 'replay-cookware',
      storyId: 'replay-story',
      title: 'Agree on cookware boundaries',
      description: 'Set an explicit shared or dedicated cookware arrangement.',
      priority: 'high',
      stage: this.replay.result.dedicatedCookwareAgreed ? 'done' : 'review',
    });

    for (const participant of this.replay.participants) {
      this.town.addAgent({
        id: participant.id,
        name: participant.name,
        role: participant.scenarioRole,
        team: 'Household',
        skills: [participant.role],
        status: 'listening',
        message: participant.goal,
      });
    }
    this.town.logActivity('system', 'system', `Loaded ${this.replay.title}`);
    this.onUpdate?.();
  }

  start(): void {
    if (this.cursor >= this.replay.events.length) this.seed();
    this.running = true;
    this.paused = false;
    this.scheduleNext(150);
    this.onUpdate?.();
  }

  stop(): void {
    this.clearTimer();
    this.running = false;
    this.paused = false;
    this.onUpdate?.();
  }

  pause(): void {
    if (!this.running) return;
    this.clearTimer();
    this.paused = true;
    this.onUpdate?.();
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.scheduleNext(100);
    this.onUpdate?.();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    if (this.running && !this.paused) {
      this.clearTimer();
      this.scheduleNext(100);
    }
  }

  get currentEvent(): ReplayEvent | null {
    return this.cursor > 0 ? this.replay.events[this.cursor - 1] ?? null : null;
  }

  private scheduleNext(delay?: number): void {
    if (!this.running || this.paused) return;
    const event = this.replay.events[this.cursor];
    if (!event) {
      this.finish();
      return;
    }
    const wait = delay ?? EVENT_DELAY[event.kind] / this.speed;
    this.timer = setTimeout(() => this.advance(), wait);
  }

  private advance(): void {
    const event = this.replay.events[this.cursor];
    if (!event) {
      this.finish();
      return;
    }
    const agent = this.town.getAgent(event.agentId);
    if (agent) {
      agent.setStatus(EVENT_ACTIVITY[event.kind], event.message);
      const target = event.target ? ` → ${event.target}` : '';
      this.town.logActivity(
        event.agentId,
        EVENT_LOG_TYPE[event.kind],
        `Round ${event.round} · ${event.kind.toUpperCase()}${target}: ${event.message}`,
      );
    }
    this.cursor += 1;
    this.onUpdate?.();
    this.scheduleNext();
  }

  private finish(): void {
    this.clearTimer();
    this.running = false;
    this.paused = false;
    const activity: AgentActivity = this.replay.result.resolved ? 'success' : 'blocked';
    const message = this.replay.result.resolved
      ? `Resolved: ${this.replay.result.outcome}`
      : `Unresolved after ${this.replay.result.completedRounds} rounds`;
    for (const participant of this.replay.participants) {
      this.town.getAgent(participant.id)?.setStatus(activity, message);
    }
    this.town.logActivity('system', 'system', message);
    this.onUpdate?.();
    this.onComplete?.();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
